const http = require('http');
http.createServer((req, res) => {
    res.write("Bot is running!");
    res.end();
}).listen(process.env.PORT || 3000);
const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    PermissionsBitField,
    ChannelType
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

// 📌 1. ใส่ Token ของคุณตรงนี้
const BOT_TOKEN = process.env.BOT_TOKEN;

// 📌 2. ข้อมูลเลขบัญชีของคุณ
const BANK_DETAILS = {
    bankName: 'ธนาคารกสิกรไทย (K-Bank)',
    accountNumber: '1648263437',
    accountName: 'นาย พงศ์พิเศษ จักรสาร',
};

client.once('ready', () => {
    console.log(`✅ บอท ${client.user.tag} ออนไลน์พร้อมใช้งานแล้ว!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // คำสั่งสร้างปุ่มสั่งซื้อ (พิมพ์ !setup-ticket ในช่องที่ต้องการวางปุ่ม)
    if (message.content === '!setup-ticket') {
        const embed = new EmbedBuilder()
            .setTitle('🛒 ศูนย์บริการสั่งซื้อสินค้า')
            .setDescription('กดปุ่มด้านล่างเพื่อเปิด Ticket สั่งซื้อสินค้า หรือติดต่อแอดมิน')
            .setColor('#2b2d31');

        const button = new ButtonBuilder()
            .setCustomId('create_ticket')
            .setLabel('📩 สั่งซื้อสินค้า / เปิด Ticket')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);

        await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete(); // ลบข้อความสั่ง !setup-ticket ออก
    }

    // คำสั่งพิมพ์ขอเลขบัญชีแบบพิมพ์เองปกติ (เช่น พิมพ์ !bank หรือ !โอน)
    const text = message.content.toLowerCase();
    if (text === '!bank' || text === '!โอน' || text === 'ขอเลขบัญชี') {
        await sendBankInfo(message.channel, message.author);
    }
});

// ระบบจัดการเมื่อลูกค้าคลิกปุ่มต่างๆ
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    // --- กรณีที่ 1: ลูกค้ากดปุ่ม "เปิด Ticket" ---
    if (interaction.customId === 'create_ticket') {
        const guild = interaction.guild;
        const user = interaction.user;

        // สร้างห้องส่วนตัวเฉพาะลูกค้ารายนั้นกับแอดมิน
        const ticketChannel = await guild.channels.create({
            name: `ticket-${user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                {
                    id: guild.id, // ซ่อนห้องจากคนทั่วไป
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                {
                    id: user.id, // อนุญาตให้ลูกค้าคนนี้เห็นห้อง
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.AttachFiles
                    ],
                },
            ],
        });

        // ตอบกลับแบบส่วนตัวให้คนกดรู้ว่าสร้างห้องแล้ว
        await interaction.reply({
            content: `✅ สร้างห้อง Ticket ของคุณเรียบร้อยแล้วที่ ${ticketChannel}`,
            ephemeral: true
        });

        // ข้อความต้อนรับ + ปุ่มขอเลขบัญชีในห้อง Ticket ใหม่
        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`ยินดีต้อนรับคุณ ${user.username}! 👋`)
            .setDescription('กรุณาพิมพ์รายละเอียดสินค้าที่ต้องการสั่งซื้อทิ้งไว้ได้เลยครับ\nหากต้องการชำระเงินทันที สามารถกดปุ่ม **"💳 ขอรับเลขบัญชี"** ด้านล่างได้เลยครับ')
            .setColor('#5865F2');

        const bankBtn = new ButtonBuilder()
            .setCustomId('get_bank_info')
            .setLabel('💳 ขอรับเลขบัญชี')
            .setStyle(ButtonStyle.Success);

        const closeBtn = new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('🔒 ปิด Ticket')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(bankBtn, closeBtn);

        await ticketChannel.send({ content: `<@${user.id}>`, embeds: [welcomeEmbed], components: [row] });
    }

    // --- กรณีที่ 2: ลูกค้ากดปุ่ม "ขอรับเลขบัญชี" ---
    if (interaction.customId === 'get_bank_info') {
        await sendBankInfo(interaction.channel, interaction.user);
        await interaction.reply({ content: 'ส่งข้อมูลเลขบัญชีให้เรียบร้อยแล้วครับ!', ephemeral: true });
    }

    // --- กรณีที่ 3: กดปิดห้อง Ticket ---
    if (interaction.customId === 'close_ticket') {
        await interaction.reply('ปิด Ticket นี้ในอีก 5 วินาที...');
        setTimeout(() => interaction.channel.delete(), 5000);
    }
});

// ฟังก์ชันสำหรับส่งการ์ดเลขบัญชี
async function sendBankInfo(channel, user, amount = null) {
    const bankEmbed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('💳 รายละเอียดช่องทางการชำระเงิน')
        .setDescription(`ส่งข้อมูลให้คุณ <@${user.id}> เรียบร้อยครับ\nเมื่อโอนเงินแล้ว กรุณาแนบ **สลิปการโอนเงิน** ในห้องนี้ได้เลยครับ`)
        .addFields(
            { name: '🏦 ธนาคาร', value: BANK_DETAILS.bankName, inline: true },
            { name: '🔢 เลขที่บัญชี', value: '```' + BANK_DETAILS.accountNumber + '```', inline: true },
            { name: '👤 ชื่อบัญชี', value: BANK_DETAILS.accountName, inline: false }
        );

    // ถ้ายอดเงินถูกส่งมา จะแสดงหัวข้อตัวใหญ่
    if (amount) {
        bankEmbed.addFields({
            name: '💵 ยอดเงินที่ต้องชำระ',
            value: `#  ${amount}`, 
            inline: false
        });
    }

    bankEmbed
        .setFooter({ text: 'ระบบการชำระเงินอัตโนมัติ' })
        .setTimestamp();

    await channel.send({ embeds: [bankEmbed] });
}
// --- ส่วนรับคำสั่งพิมพ์ข้อความ !bank [จำนวนเงิน] ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith('!bank')) {
        const args = message.content.split(' ');
        const amount = args[1] || null;

        await sendBankInfo(message.channel, message.author, amount);
    }
});
client.login(BOT_TOKEN);
