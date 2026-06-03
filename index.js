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

const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");

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

function getSheetId(guildId) {
    if (process.env.SERVER_CONFIG_JSON) {
        const config = JSON.parse(process.env.SERVER_CONFIG_JSON);
        if (config[guildId]) return config[guildId];
    }

    return process.env.SHEET_ID;
}

async function getSheet(guildId) {
    const sheetId = getSheetId(guildId);

    const auth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    const doc = new GoogleSpreadsheet(sheetId, auth);
    await doc.loadInfo();

    const sheet = doc.sheetsByIndex[0];

    await sheet.setHeaderRow([
        "Discord ID",
        "Tên Discord",
        "Tên nhân vật",
        "Môn phái",
        "Bang Chiến",
        "Scrim",
        "Rank",
        "Server",
        "Thời gian"
    ]);

    return sheet;
}

async function saveToGoogleSheet(data) {
    const sheet = await getSheet(data.guildId);
    const rows = await sheet.getRows();

    const oldRow = rows.find(row => row.get("Discord ID") === data.discordId);

    if (oldRow) {
        oldRow.set("Tên Discord", data.discordName);
        oldRow.set("Tên nhân vật", data.tenNhanVat);
        oldRow.set("Môn phái", data.monPhai);
        oldRow.set("Bang Chiến", data.bangChien);
        oldRow.set("Scrim", data.scrim);
        oldRow.set("Rank", data.rank);
        oldRow.set("Server", data.guildName);
        oldRow.set("Thời gian", data.time);
        await oldRow.save();
    } else {
        await sheet.addRow({
            "Discord ID": data.discordId,
            "Tên Discord": data.discordName,
            "Tên nhân vật": data.tenNhanVat,
            "Môn phái": data.monPhai,
            "Bang Chiến": data.bangChien,
            "Scrim": data.scrim,
            "Rank": data.rank,
            "Server": data.guildName,
            "Thời gian": data.time
        });
    }
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once("clientReady", async () => {
    console.log(`✅ Bot đã online: ${client.user.tag}`);

    try {
        const channel = await client.channels.fetch(CHANNEL_ID);

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("toaimong").setLabel("Toái Mộng").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("thantuong").setLabel("Thần Tương").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("huyetha").setLabel("Huyết Hà").setStyle(ButtonStyle.Danger)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("longngam").setLabel("Long Ngâm").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("cuulinh").setLabel("Cửu Linh").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("tovan").setLabel("Tố Vấn").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("thiety").setLabel("Thiết Y").setStyle(ButtonStyle.Secondary)
        );

        await channel.send({
            content: "📋 **ĐĂNG KÝ BANG CHIẾN**\n\nVui lòng chọn môn phái:",
            components: [row1, row2]
        });
    } catch (error) {
        console.log("⚠️ Không gửi được bảng nút tự động. Kiểm tra CHANNEL_ID.");
    }
});

client.on("interactionCreate", async (interaction) => {
    try {
        if (interaction.isButton()) {
            const monPhai = monPhaiMap[interaction.customId];
            if (!monPhai) return;

            tempData[interaction.user.id] = {
                guildId: interaction.guild.id,
                guildName: interaction.guild.name,
                discordId: interaction.user.id,
                discordName: interaction.member.displayName,
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

            const tenNhanVat = interaction.fields.getTextInputValue("ten_nhan_vat");
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
                components: [new ActionRowBuilder().addComponents(bangChienMenu)],
                ephemeral: true
            });
        }

        if (interaction.isStringSelectMenu()) {
            const userId = interaction.user.id;

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
                    content: `✅ Bang Chiến: **${tempData[userId].bangChien}**\n\nTiếp theo chọn đánh Scrim:`,
                    components: [new ActionRowBuilder().addComponents(scrimMenu)]
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
                    content: `✅ Scrim: **${tempData[userId].scrim}**\n\nTiếp theo chọn Rank:`,
                    components: [new ActionRowBuilder().addComponents(rankMenu)]
                });
            }

            if (interaction.customId === "select_rank") {
                tempData[userId].rank = interaction.values[0];

                const data = {
                    ...tempData[userId],
                    time: new Date().toLocaleString("vi-VN")
                };

                await saveToGoogleSheet(data);

                await interaction.update({
                    content:
                        `✅ **ĐĂNG KÝ THÀNH CÔNG**\n\n` +
                        `👤 Tên nhân vật: **${data.tenNhanVat}**\n` +
                        `⚔️ Môn phái: **${data.monPhai}**\n` +
                        `🏰 Bang Chiến: **${data.bangChien}**\n` +
                        `🥊 Scrim: **${data.scrim}**\n` +
                        `🏆 Rank: **${data.rank}**\n\n` +
                        `📊 Dữ liệu đã được lưu lên Google Sheets.`,
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