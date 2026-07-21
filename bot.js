const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');

const ALLOWED_USERS = ['542927955903512587', '1515213214110060618', '1220053148874575994'];

async function startBot(pool, generateKeyString, token) {
  if (!token) {
    console.log('[BOT] No DISCORD_BOT_TOKEN provided. Bot is disabled.');
    return;
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  const commands = [
    new SlashCommandBuilder()
      .setName('genkey')
      .setDescription('Generates a new API key using the interactive form.')
  ];

  const rest = new REST({ version: '10' }).setToken(token);

  client.on('ready', async () => {
    console.log(`[BOT] Logged in as ${client.user.tag}!`);
    try {
      console.log('[BOT] Refreshing application (/) commands.');
      const bodyData = commands.map(c => c.toJSON());
      
      // 1. Deploy Globally (takes up to 1 hour to propagate)
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: bodyData },
      );
      
      // 2. Deploy specifically to every server the bot is currently in (INSTANT propagation!)
      const guilds = client.guilds.cache;
      for (const [guildId, guild] of guilds) {
        try {
          await rest.put(
            Routes.applicationGuildCommands(client.user.id, guildId),
            { body: bodyData }
          );
          console.log(`[BOT] Instantly deployed commands to server: ${guild.name} (${guildId})`);
        } catch (e) {
          console.error(`[BOT] Failed to deploy to guild ${guildId}:`, e.message);
        }
      }
      
      console.log('[BOT] Successfully reloaded application (/) commands.');
    } catch (error) {
      console.error(error);
    }
  });

  client.on('interactionCreate', async interaction => {
    if (!ALLOWED_USERS.includes(interaction.user.id)) {
      if (interaction.isRepliable()) {
        return interaction.reply({ content: '⛔ You are not authorized to use this command.', ephemeral: true });
      }
      return;
    }

    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'genkey') {
        // Build the Modal (Component V2)
        const modal = new ModalBuilder()
          .setCustomId('genkeyModal')
          .setTitle('Generate API Key');

        // Create the text input components
        const targetUserIdInput = new TextInputBuilder()
          .setCustomId('targetUserId')
          .setLabel("Target User ID")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Enter the Discord User ID')
          .setRequired(true);

        const planInput = new TextInputBuilder()
          .setCustomId('planType')
          .setLabel("Plan Type")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g., owner, plus, pro, enterprise')
          .setRequired(true);

        const durationInput = new TextInputBuilder()
          .setCustomId('durationDays')
          .setLabel("Duration (Days)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g., 1, 7, 30, or 9999 for Lifetime')
          .setRequired(true);

        // Add inputs to action rows
        const firstActionRow = new ActionRowBuilder().addComponents(targetUserIdInput);
        const secondActionRow = new ActionRowBuilder().addComponents(planInput);
        const thirdActionRow = new ActionRowBuilder().addComponents(durationInput);

        // Add action rows to modal
        modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

        // Show the modal to the user
        await interaction.showModal(modal);
      }
    } else if (interaction.isModalSubmit()) {
      if (interaction.customId === 'genkeyModal') {
        const targetUserId = interaction.fields.getTextInputValue('targetUserId');
        const plan = interaction.fields.getTextInputValue('planType');
        const lengthInput = interaction.fields.getTextInputValue('durationDays');

        const durationDays = parseInt(lengthInput);
        if (isNaN(durationDays) || durationDays <= 0) {
          return interaction.reply({ content: 'Invalid length provided. Please provide a valid number of days.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
          // Fetch the target user object
          let targetUser;
          try {
            targetUser = await client.users.fetch(targetUserId);
          } catch (e) {
            return interaction.editReply({ content: '❌ Invalid User ID. Please make sure it is a valid Discord ID.' });
          }

          const email = targetUser.username;
          const keyStr = generateKeyString(email, plan);
          
          const newKey = {
            id: Date.now(),
            key: keyStr,
            plan: plan,
            email: email,
            durationDays: durationDays,
            expires: durationDays === 9999 ? null : Date.now() + (durationDays * 24 * 60 * 60 * 1000)
          };

          await pool.query(
            'INSERT INTO api_keys (id, key, plan, email, duration_days, expires) VALUES ($1, $2, $3, $4, $5, $6)',
            [newKey.id, newKey.key, newKey.plan, newKey.email, newKey.durationDays, newKey.expires]
          );

          // DM the user
          try {
            const keyEmbed = new EmbedBuilder()
              .setTitle('Welcome to Reveal Intelligence! 🚀')
              .setDescription(`Your **${plan}** API Key has been generated by an admin.\n\n**Your Key:** \`${newKey.key}\`\n**Duration:** ${durationDays === 9999 ? 'Lifetime' : durationDays + ' Days'}\n\n*Keep this key safe and do not share it!*`)
              .setColor(0x5865F2);
            
            await targetUser.send({ embeds: [keyEmbed] });
            await interaction.editReply({ content: `✅ Successfully generated a **${plan}** key for ${durationDays} days and DM'd it to ${targetUser.username} (\`${targetUserId}\`).` });
          } catch (dmError) {
            console.error('Failed to DM user:', dmError);
            await interaction.editReply({ content: `✅ Successfully generated the key, but **failed to DM the user**. Their DMs might be closed.\n\nKey: \`${newKey.key}\`` });
          }

        } catch (error) {
          console.error('Database Error in Bot:', error);
          await interaction.editReply({ content: '❌ Failed to generate key due to a database error.' });
        }
      }
    }
  });

  client.login(token).catch(err => {
    console.error('[BOT] Failed to login:', err);
  });
}

module.exports = { startBot };
