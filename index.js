require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");

const {
    saveRegistration,
    getAllRegistrations
} = require("./database");

const XLSX = require("xlsx");
const path = require("path");

const CHANNEL_ID = "1489617974380855357";

const monPhaiMap = {
    toaimong: "Toái Mộng",
    thantuong: "Thần Tương",
    huyetha: "Huyết Hà",
    longngam: "Long Ngâm",
    cuulinh: "Cửu Linh",
    tovan: "Tố Vấn",
    thiety: "Thiết Y"
};

const tempData = {};

async function autoSaveExcel() {
    const rows = await getAllRegistrations();

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "BangChien");

    const filePath = path.join(__dirname, "BangChien.xlsx");

    XLSX.writeFile(workbook, filePath);
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once("clientReady", async () => {
    console.log(`✅ Bot đã online: ${client.user.tag}`);

    const channel = await client.channels.fetch(CHANNEL_ID);

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("toaimong")
            .setLabel("Toái Mộng")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId("thantuong")
            .setLabel("Thần Tương")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId("huyetha")
            .setLabel("Huyết Hà")
            .setStyle(ButtonStyle.Danger)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("longngam")
            .setLabel("Long Ngâm")
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId("cuulinh")
            .setLabel("Cửu Linh")
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId("tovan")
            .setLabel("Tố Vấn")
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId("thiety")
            .setLabel("Thiết Y")
            .setStyle(ButtonStyle.Secondary)
    );

    await channel.send({
        content: "📋 **ĐĂNG KÝ BANG CHIẾN**\n\nVui lòng chọn môn phái:",
        components: [row1, row2]
    });
});

client.on("interactionCreate", async (interaction) => {
    try {
        if (interaction.isButton()) {
            const monPhai = monPhaiMap[interaction.customId];
            if (!monPhai) return;

            tempData[interaction.user.id] = {
                discordId: interaction.user.id,
                monPhai: monPhai
            };

            const modal = new ModalBuilder()
                .setCustomId("tennhanvat_modal")
                .setTitle(`Đăng ký - ${monPhai}`);

            const tenInput = new TextInputBuilder()
                .setCustomId("ten_nhan_vat")
                .setLabel("Tên nhân vật trong game")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(tenInput)
            );

            await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit()) {
            const userId = interaction.user.id;

            if (!tempData[userId]) {
                return interaction.reply({
                    content: "❌ Bạn chưa chọn môn phái.",
                    ephemeral: true
                });
            }

            const tenNhanVat =
                interaction.fields.getTextInputValue("ten_nhan_vat");

            tempData[userId].tenNhanVat = tenNhanVat;

            const bangChienMenu = new StringSelectMenuBuilder()
                .setCustomId("select_bangchien")
                .setPlaceholder("Chọn tham gia Bang Chiến")
                .addOptions(
                    { label: "Có", value: "Có" },
                    { label: "Không", value: "Không" }
                );

            await interaction.reply({
                content:
                    `👤 Tên nhân vật: **${tenNhanVat}**\n` +
                    `⚔️ Môn phái: **${tempData[userId].monPhai}**\n\n` +
                    `Tiếp theo chọn tham gia Bang Chiến:`,
                components: [
                    new ActionRowBuilder().addComponents(bangChienMenu)
                ],
                ephemeral: true
            });
        }

        if (interaction.isStringSelectMenu()) {
            const userId = interaction.user.id;

            if (!tempData[userId]) {
                return interaction.reply({
                    content: "❌ Bạn chưa chọn môn phái.",
                    ephemeral: true
                });
            }

            if (interaction.customId === "select_bangchien") {
                tempData[userId].bangChien = interaction.values[0];

                const scrimMenu = new StringSelectMenuBuilder()
                    .setCustomId("select_scrim")
                    .setPlaceholder("Chọn đánh Scrim")
                    .addOptions(
                        { label: "Có", value: "Có" },
                        { label: "Không", value: "Không" }
                    );

                await interaction.update({
                    content:
                        `✅ Bang Chiến: **${tempData[userId].bangChien}**\n\n` +
                        `Tiếp theo chọn đánh Scrim:`,
                    components: [
                        new ActionRowBuilder().addComponents(scrimMenu)
                    ]
                });
            }

            if (interaction.customId === "select_scrim") {
                tempData[userId].scrim = interaction.values[0];

                const rankMenu = new StringSelectMenuBuilder()
                    .setCustomId("select_rank")
                    .setPlaceholder("Chọn Rank")
                    .addOptions(
                        { label: "Đồng", value: "Đồng" },
                        { label: "Bạc", value: "Bạc" },
                        { label: "Vàng", value: "Vàng" },
                        { label: "Quỳnh Ngọc", value: "Quỳnh Ngọc" },
                        { label: "Lưu Ly", value: "Lưu Ly" },
                        { label: "Tông Sư", value: "Tông Sư" },
                        { label: "Truyền Thuyết", value: "Truyền Thuyết" },
                        { label: "Cái Thế", value: "Cái Thế" },
                        { label: "Vô Song", value: "Vô Song" }
                    );

                await interaction.update({
                    content:
                        `✅ Scrim: **${tempData[userId].scrim}**\n\n` +
                        `Tiếp theo chọn Rank:`,
                    components: [
                        new ActionRowBuilder().addComponents(rankMenu)
                    ]
                });
            }

            if (interaction.customId === "select_rank") {
                tempData[userId].rank = interaction.values[0];

                const data = {
                    ...tempData[userId],
                    time: new Date().toLocaleString("vi-VN")
                };

                await saveRegistration(data);
                await autoSaveExcel();

                await interaction.update({
                    content:
                        `✅ **ĐĂNG KÝ THÀNH CÔNG**\n\n` +
                        `👤 Tên nhân vật: **${data.tenNhanVat}**\n` +
                        `⚔️ Môn phái: **${data.monPhai}**\n` +
                        `🏰 Bang Chiến: **${data.bangChien}**\n` +
                        `🥊 Scrim: **${data.scrim}**\n` +
                        `🏆 Rank: **${data.rank}**\n\n` +
                        `💾 Dữ liệu đã được lưu vào database và Excel.`,
                    components: []
                });

                delete tempData[userId];
            }
        }
    } catch (error) {
        console.error(error);

        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: "❌ Có lỗi khi xử lý đăng ký.",
                ephemeral: true
            });
        }
    }
});

client.login(process.env.TOKEN);