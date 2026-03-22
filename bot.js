require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
} = require("discord.js");
const cron = require("node-cron");

// ─── Client Setup ───────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ─── Fetch Latest Deals From Your Source Channel ───────────────────────────
async function getDealsFromSourceChannel() {
  const sourceChannelId = process.env.SOURCE_CHANNEL_ID;
  if (!sourceChannelId) return console.error("❌ SOURCE_CHANNEL_ID not set in .env"), null;

  const channel = await client.channels.fetch(sourceChannelId).catch(() => null);
  if (!channel) return console.error("❌ Could not find source channel:", sourceChannelId), null;

  const messages = await channel.messages.fetch({ limit: 1 });
  const latest = messages.first();
  if (!latest) return console.error("❌ No messages found in source channel"), null;

  return latest.content;
}

// ─── Build the Weekly Embed ─────────────────────────────────────────────────
function buildDealsEmbed(dealsText) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return new EmbedBuilder()
    .setColor(0xf5a623)
    .setTitle("💰  Weekly Prop Firm Deals")
    .setDescription(
      [
        `📅 **Week of ${today}**`,
        "",
        dealsText,
        "",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "🏷️  Use code **`KEV`** at checkout for your discount!",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━",
      ].join("\n")
    )
    .setFooter({
      text: "Your support is genuinely appreciated — use code KEV at checkout to save",
    })
    .setTimestamp();
}

// ─── Post Weekly Deals ──────────────────────────────────────────────────────
async function postWeeklyDeals() {
  console.log("⏰ Running weekly deals post...");

  const postChannelId = process.env.POST_CHANNEL_ID;
  if (!postChannelId) return console.error("❌ POST_CHANNEL_ID not set in .env");

  const postChannel = await client.channels.fetch(postChannelId).catch(() => null);
  if (!postChannel) return console.error("❌ Could not find post channel:", postChannelId);

  const dealsText = await getDealsFromSourceChannel();
  if (!dealsText) return console.error("❌ No deals content — skipping post");

  // Delete the last bot message if there is one
  const messages = await postChannel.messages.fetch({ limit: 20 });
  const lastBotMessage = messages.find((m) => m.author.id === client.user.id);
  if (lastBotMessage) {
    await lastBotMessage.delete().catch(() => console.log("⚠️ Could not delete previous message"));
  }

  const embed = buildDealsEmbed(dealsText);
  await postChannel.send({ embeds: [embed] });
  console.log(`✅ Weekly deals posted to #${postChannel.name}`);
}

// ─── Slash Commands ─────────────────────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName("postdeals")
    .setDescription("Manually trigger the weekly deals embed right now")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON(),
];

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log("✅ Slash commands registered");
  } catch (err) {
    console.error("❌ Failed to register commands:", err);
  }
}

// ─── Bot Events ─────────────────────────────────────────────────────────────
client.once("clientReady", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await registerCommands();

  // Every Monday at 9:00 AM UTC
  // Change "1" to: 0=Sun, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  cron.schedule("0 9 * * 1", () => postWeeklyDeals());
  console.log("⏰ Scheduler active — posts every Monday at 9:00 AM UTC");
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === "postdeals") {
    await interaction.deferReply({ flags: 64 });
    await postWeeklyDeals();
    await interaction.editReply("✅ Weekly deals posted!");
  }
});

// ─── Login ──────────────────────────────────────────────────────────────────
client.login(process.env.BOT_TOKEN);
