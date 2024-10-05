// Load environment variables from the .env file
require('dotenv').config();

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers, // Required for fetching members and roles
        GatewayIntentBits.MessageContent
    ]
});

let friendCodes = {};

// Load friend codes from JSON file when bot starts
function loadFriendCodes() {
    if (fs.existsSync('friendcodes.json')) {
        const data = fs.readFileSync('friendcodes.json', 'utf-8');
        friendCodes = JSON.parse(data);
    }
}

// Save friend codes to JSON file
function saveFriendCodes() {
    fs.writeFileSync('friendcodes.json', JSON.stringify(friendCodes, null, 2));
}

client.once('ready', () => {
    console.log('Bot is online!');
    loadFriendCodes();  // Load friend codes from the file

    // Register slash commands when bot is ready
    const commands = [
        new SlashCommandBuilder()
            .setName('showcodes')
            .setDescription('Show all friend codes stored by everyone'),

        new SlashCommandBuilder()
            .setName('addcode')
            .setDescription('Add a new friend code')
            .addStringOption(option => 
                option.setName('trainer')
                      .setDescription('Trainer name')
                      .setRequired(true))
            .addStringOption(option =>
                option.setName('code')
                      .setDescription('Friend code')
                      .setRequired(true)),

        new SlashCommandBuilder()
            .setName('updatecode')
            .setDescription('Update an existing friend code')
            .addStringOption(option => 
                option.setName('trainer')
                      .setDescription('Trainer name')
                      .setRequired(true))
            .addStringOption(option =>
                option.setName('newcode')
                      .setDescription('New friend code')
                      .setRequired(true)),

        new SlashCommandBuilder()
            .setName('deletecode')
            .setDescription('Delete a friend code')
            .addStringOption(option => 
                option.setName('trainer')
                      .setDescription('Trainer name')
                      .setRequired(true)),
    ].map(command => command.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN); // Load the token from the .env file

    rest.put(Routes.applicationGuildCommands(client.user.id, '1273072036151033896'), { body: commands })  // Replace 'YOUR_GUILD_ID' with your actual guild ID
        .then(() => console.log('Successfully registered guild-specific application commands.'))
        .catch(console.error);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, user, guild } = interaction;
    const userId = user.id;

    // Ensure userId has an initialized array of friend codes
    if (!friendCodes[userId]) {
        friendCodes[userId] = [];
    }

    if (commandName === 'showcodes') {
        if (Object.keys(friendCodes).length === 0) {
            await interaction.reply({
                content: 'No friend codes have been added by anyone.',
                ephemeral: true
            });
            return;
        }

        let codesList = 'All stored friend codes from everyone:\n';
        for (const userId in friendCodes) {
            const userCodes = friendCodes[userId];
            if (userCodes.length === 0) continue;

            try {
                const member = await guild.members.fetch(userId);
                const username = member.user.username;
                let team = '';

                if (member.roles.cache.some(role => role.name === 'Team Valor')) {
                    team = 'Team Valor';
                } else if (member.roles.cache.some(role => role.name === 'Team Instinct')) {
                    team = 'Team Instinct';
                } else if (member.roles.cache.some(role => role.name === 'Team Mystic')) {
                    team = 'Team Mystic';
                } else {
                    team = 'No team';
                }

                codesList += `\n**${username} (${team})'s codes:**\n`;

                userCodes.forEach((entry, index) => {
                    codesList += `${index + 1}. Trainer: ${entry.trainer}, Code: ${entry.code}\n`;
                });
            } catch (error) {
                console.error(`Error fetching user with ID ${userId}:`, error);
                codesList += `\n**Unknown User (ID: ${userId})'s codes:**\n`;
                userCodes.forEach((entry, index) => {
                    codesList += `${index + 1}. Trainer: ${entry.trainer}, Code: ${entry.code}\n`;
                });
            }
        }

        await interaction.reply({
            content: codesList,
            ephemeral: true
        });
    }

    else if (commandName === 'addcode') {
        const trainer = interaction.options.getString('trainer');
        const code = interaction.options.getString('code');

        friendCodes[userId].push({ trainer, code });
        saveFriendCodes();

        await interaction.reply({
            content: `Friend code for trainer ${trainer} added successfully!`
        });
    }

    else if (commandName === 'updatecode') {
        const trainer = interaction.options.getString('trainer');
        const newCode = interaction.options.getString('newcode');

        if (friendCodes[userId].length === 0) {
            await interaction.reply({
                content: 'You have no stored friend codes to update.',
                ephemeral: true
            });
            return;
        }

        let updated = false;
        friendCodes[userId].forEach(entry => {
            if (entry.trainer && entry.trainer.toLowerCase() === trainer.toLowerCase()) {
                entry.code = newCode;
                updated = true;
            }
        });

        if (updated) {
            saveFriendCodes();
            await interaction.reply({
                content: `Friend code for trainer ${trainer} updated successfully!`
            });
        } else {
            await interaction.reply({
                content: `No friend code found for trainer ${trainer}.`,
                ephemeral: true
            });
        }
    }

    else if (commandName === 'deletecode') {
        const trainer = interaction.options.getString('trainer');

        if (friendCodes[userId].length === 0) {
            await interaction.reply({
                content: 'You have no stored friend codes to delete.',
                ephemeral: true
            });
            return;
        }

        const initialLength = friendCodes[userId].length;
        friendCodes[userId] = friendCodes[userId].filter(entry => entry.trainer.toLowerCase() !== trainer.toLowerCase());

        if (friendCodes[userId].length < initialLength) {
            saveFriendCodes();
            await interaction.reply({
                content: `Friend code for trainer ${trainer} deleted successfully!`
            });
        } else {
            await interaction.reply({
                content: `No friend code found for trainer ${trainer}.`,
                ephemeral: true
            });
        }
    }
});

// Use the token from the .env file
client.login(process.env.DISCORD_BOT_TOKEN);
