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
    TextInputStyle,
    PermissionFlagsBits
} = require("discord.js");

const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");

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

function getKey(interaction) {
    return `${interaction.guild.id}_${interaction.user.id}`;
}

function getSheetId(guildId) {
    if (process.env.SERVER_CONFIG_JSON) {
        const config = JSON.parse(process.env.SERVER_CONFIG_JSON);
        if (config[guildId]) return config[guildId];
    }
    return process.env.SHEET_ID;
}

async function getSheet(guildId) {
    const auth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    const doc = new GoogleSpreadsheet(getSheetId(guildId), auth);
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

async function deleteRegistration(guildId, discordId) {
    const sheet = await getSheet(guildId);
    const rows = await sheet.getRows();

    const row = rows.find(r => r.get("Discord ID") === discordId);
    if (!row) return false;

    await row.delete();
    return true;
}

async function getAllRows(guildId) {
    const sheet = await getSheet(guildId);
    return await sheet.getRows();
}

function createMainButtons() {
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

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("edit_register").setLabel("✏️ Sửa thông tin").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("delete_register").setLabel("🗑️ Hủy đăng ký").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("stats_class").setLabel("📊 Thống kê").setStyle(ButtonStyle.Secondary)
    );

    const row4 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("list_bangchien").setLabel("📋 DS Bang Chiến").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("list_scrim").setLabel("📋 DS Scrim").setStyle(ButtonStyle.Success)
    );

    return [row1, row2, row3, row4];
}

function createEditClassButtons() {
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("edit_toaimong").setLabel("Toái Mộng").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("edit_thantuong").setLabel("Thần Tương").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("edit_huyetha").setLabel("Huyết Hà").setStyle(ButtonStyle.Danger)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("edit_longngam").setLabel("Long Ngâm").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("edit_cuulinh").setLabel("Cửu Linh").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("edit_tovan").setLabel("Tố Vấn").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("edit_thiety").setLabel("Thiết Y").setStyle(ButtonStyle.Secondary)
    );

    return [row1, row2];
}

async function openNameModal(interaction, monPhai, mode = "register") {
    const key = getKey(interaction);

    tempData[key] = {
        guildId: interaction.guild.id,
        guildName: interaction.guild.name,
        discordId: interaction.user.id,
        discordName: interaction.member.displayName,
        monPhai,
        mode
    };

    const modal = new ModalBuilder()
        .setCustomId("tennhanvat_modal")
        .setTitle(mode === "edit" ? `Sửa - ${monPhai}` : `Đăng ký - ${monPhai}`);

    const tenInput = new TextInputBuilder()
        .setCustomId("ten_nhan_vat")
        .setLabel("Tên nhân vật trong game")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(tenInput));

    await interaction.showModal(modal);
}

function createBangChienMenu() {
    return new StringSelectMenuBuilder()
        .setCustomId("select_bangchien")
        .setPlaceholder("Chọn tham gia Bang Chiến")
        .addOptions(
            { label: "Có", value: "Có" },
            { label: "Không", value: "Không" }
        );
}

function createScrimMenu() {
    return new StringSelectMenuBuilder()
        .setCustomId("select_scrim")
        .setPlaceholder("Chọn đánh Scrim")
        .addOptions(
            { label: "Có", value: "Có" },
            { label: "Không", value: "Không" }
        );
}

function createRankMenu() {
    return new StringSelectMenuBuilder()
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
}

async function sendStats(interaction) {
    const rows = await getAllRows(interaction.guild.id);

    const counts = {};
    Object.values(monPhaiMap).forEach(name => counts[name] = 0);

    rows.forEach(row => {
        const monPhai = row.get("Môn phái");
        if (counts[monPhai] !== undefined) counts[monPhai]++;
    });

    let message = "📊 **THỐNG KÊ MÔN PHÁI**\n\n";

    for (const [monPhai, count] of Object.entries(counts)) {
        message += `⚔️ ${monPhai}: **${count}**\n`;
    }

    message += `\n👥 Tổng: **${rows.length}**`;

    await interaction.reply({
        content: message,
        ephemeral: true
    });
}

async function sendList(interaction, type) {
    const rows = await getAllRows(interaction.guild.id);

    let filtered = rows;

    if (type === "bangchien") {
        filtered = rows.filter(row => row.get("Bang Chiến") === "Có");
    }

    if (type === "scrim") {
        filtered = rows.filter(row => row.get("Scrim") === "Có");
    }

    if (filtered.length === 0) {
        return interaction.reply({
            content: "❌ Chưa có dữ liệu phù hợp.",
            ephemeral: true
        });
    }

    const title =
        type === "bangchien"
            ? "🏰 DANH SÁCH BANG CHIẾN"
            : "🥊 DANH SÁCH SCRIM";

    let message = `**${title}**\n\n`;

    filtered.slice(0, 40).forEach((row, index) => {
        message += `${index + 1}. **${row.get("Tên nhân vật")}** - ${row.get("Môn phái")} - ${row.get("Rank")}\n`;
    });

    if (filtered.length > 40) {
        message += `\n...và ${filtered.length - 40} người khác. Xem đầy đủ trên Google Sheets.`;
    }

    await interaction.reply({
        content: message,
        ephemeral: true
    });
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once("clientReady", async () => {
    console.log(`✅ Bot đã online: ${client.user.tag}`);

    await client.application.commands.set([
        {
            name: "taoform",
            description: "Tạo bảng đăng ký Bang Chiến"
        },
        {
            name: "thongke",
            description: "Xem thống kê môn phái"
        },
        {
            name: "danhsach",
            description: "Xem danh sách Bang Chiến hoặc Scrim",
            options: [
                {
                    name: "loai",
                    description: "Chọn loại danh sách",
                    type: 3,
                    required: true,
                    choices: [
                        { name: "Bang Chiến", value: "bangchien" },
                        { name: "Scrim", value: "scrim" }
                    ]
                }
            ]
        }
    ]);
});

client.on("interactionCreate", async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === "taoform") {
                if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({
                        content: "❌ Chỉ Admin mới được tạo form đăng ký.",
                        ephemeral: true
                    });
                }

                await interaction.reply({
                    content: "📋 **ĐĂNG KÝ BANG CHIẾN**\n\nVui lòng chọn môn phái:",
                    components: createMainButtons()
                });
            }

            if (interaction.commandName === "thongke") {
                await sendStats(interaction);
            }

            if (interaction.commandName === "danhsach") {
                const type = interaction.options.getString("loai");
                await sendList(interaction, type);
            }
        }

        if (interaction.isButton()) {
            if (monPhaiMap[interaction.customId]) {
                return await openNameModal(interaction, monPhaiMap[interaction.customId], "register");
            }

            if (interaction.customId.startsWith("edit_")) {
                const monPhaiId = interaction.customId.replace("edit_", "");
                const monPhai = monPhaiMap[monPhaiId];

                if (!monPhai) return;

                return await openNameModal(interaction, monPhai, "edit");
            }

            if (interaction.customId === "edit_register") {
                return interaction.reply({
                    content: "✏️ Chọn lại môn phái để sửa thông tin:",
                    components: createEditClassButtons(),
                    ephemeral: true
                });
            }

            if (interaction.customId === "delete_register") {
                const deleted = await deleteRegistration(interaction.guild.id, interaction.user.id);

                return interaction.reply({
                    content: deleted
                        ? "🗑️ Đã hủy đăng ký của bạn."
                        : "❌ Bạn chưa có đăng ký để hủy.",
                    ephemeral: true
                });
            }

            if (interaction.customId === "stats_class") {
                return await sendStats(interaction);
            }

            if (interaction.customId === "list_bangchien") {
                return await sendList(interaction, "bangchien");
            }

            if (interaction.customId === "list_scrim") {
                return await sendList(interaction, "scrim");
            }
        }

        if (interaction.isModalSubmit()) {
            const key = getKey(interaction);

            if (!tempData[key]) {
                return interaction.reply({
                    content: "❌ Phiên đăng ký đã hết hạn, vui lòng bấm lại môn phái.",
                    ephemeral: true
                });
            }

            const tenNhanVat = interaction.fields.getTextInputValue("ten_nhan_vat");
            tempData[key].tenNhanVat = tenNhanVat;

            await interaction.reply({
                content:
                    `👤 Tên nhân vật: **${tenNhanVat}**\n` +
                    `⚔️ Môn phái: **${tempData[key].monPhai}**\n\n` +
                    `Tiếp theo chọn tham gia Bang Chiến:`,
                components: [new ActionRowBuilder().addComponents(createBangChienMenu())],
                ephemeral: true
            });
        }

        if (interaction.isStringSelectMenu()) {
            const key = getKey(interaction);

            if (!tempData[key]) {
                return interaction.reply({
                    content: "❌ Phiên đăng ký đã hết hạn, vui lòng bấm lại môn phái.",
                    ephemeral: true
                });
            }

            if (interaction.customId === "select_bangchien") {
                tempData[key].bangChien = interaction.values[0];

                return interaction.update({
                    content: `✅ Bang Chiến: **${tempData[key].bangChien}**\n\nTiếp theo chọn đánh Scrim:`,
                    components: [new ActionRowBuilder().addComponents(createScrimMenu())]
                });
            }

            if (interaction.customId === "select_scrim") {
                tempData[key].scrim = interaction.values[0];

                return interaction.update({
                    content: `✅ Scrim: **${tempData[key].scrim}**\n\nTiếp theo chọn Rank:`,
                    components: [new ActionRowBuilder().addComponents(createRankMenu())]
                });
            }

            if (interaction.customId === "select_rank") {
                tempData[key].rank = interaction.values[0];

                const data = {
                    ...tempData[key],
                    time: new Date().toLocaleString("vi-VN")
                };

                await saveToGoogleSheet(data);

                await interaction.update({
                    content:
                        `✅ **${data.mode === "edit" ? "SỬA THÔNG TIN" : "ĐĂNG KÝ"} THÀNH CÔNG**\n\n` +
                        `👤 Tên nhân vật: **${data.tenNhanVat}**\n` +
                        `⚔️ Môn phái: **${data.monPhai}**\n` +
                        `🏰 Bang Chiến: **${data.bangChien}**\n` +
                        `🥊 Scrim: **${data.scrim}**\n` +
                        `🏆 Rank: **${data.rank}**\n\n` +
                        `📊 Dữ liệu đã được cập nhật lên Google Sheets.`,
                    components: []
                });

                delete tempData[key];
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