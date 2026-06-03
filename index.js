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

let FORM_OPEN = true;

const monPhaiMap = {
    toaimong: "Toái Mộng",
    thantuong: "Thần Tương",
    huyetha: "Huyết Hà",
    longngam: "Long Ngâm",
    cuulinh: "Cửu Linh",
    tovan: "Tố Vấn",
    thiety: "Thiết Y"
};

const monPhaiColors = {
    "Toái Mộng": { red: 0.00, green: 0.75, blue: 1.00 },
    "Tố Vấn": { red: 1.00, green: 0.71, blue: 0.76 },
    "Thiết Y": { red: 1.00, green: 0.84, blue: 0.00 },
    "Long Ngâm": { red: 0.20, green: 0.80, blue: 0.20 },
    "Cửu Linh": { red: 0.58, green: 0.44, blue: 0.86 },
    "Huyết Hà": { red: 1.00, green: 0.39, blue: 0.28 },
    "Thần Tương": { red: 0.53, green: 0.81, blue: 0.98 }
};

const tempData = {};

function isAdmin(interaction) {
    return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

function getGuildId(interaction) {
    return interaction.guildId || interaction.guild?.id || "default";
}

function getGuildName(interaction) {
    return interaction.guild?.name || "Unknown Server";
}

function getDisplayName(interaction) {
    return interaction.member?.displayName || interaction.user?.globalName || interaction.user?.username || "Unknown";
}

function getKey(interaction) {
    return `${getGuildId(interaction)}_${interaction.user.id}`;
}

function getConfiguredSheetId(guildId) {
    if (process.env.SERVER_CONFIG_JSON) {
        try {
            const config = JSON.parse(process.env.SERVER_CONFIG_JSON);
            if (config[guildId]) return config[guildId];
        } catch (error) {
            console.error("SERVER_CONFIG_JSON bị sai định dạng:", error);
        }
    }

    return null;
}

function createAuth() {
    return new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        scopes: [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive"
        ]
    });
}

async function findOrCreateSheetId(guildId, guildName) {
    const configuredSheetId = getConfiguredSheetId(guildId);

    if (configuredSheetId) {
        return configuredSheetId;
    }

    const auth = createAuth();
    const safeGuildName = guildName.replace(/'/g, "");
    const title = `BangChien - ${safeGuildName} - ${guildId}`;

    const searchRes = await auth.request({
        url: "https://www.googleapis.com/drive/v3/files",
        method: "GET",
        params: {
            q: `name='${title}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
            fields: "files(id,name)"
        }
    });

    if (searchRes.data.files && searchRes.data.files.length > 0) {
        return searchRes.data.files[0].id;
    }

    const createRes = await auth.request({
        url: "https://sheets.googleapis.com/v4/spreadsheets",
        method: "POST",
        data: {
            properties: {
                title
            }
        }
    });

    const newSheetId = createRes.data.spreadsheetId;

    if (process.env.GOOGLE_OWNER_EMAIL) {
        await auth.request({
            url: `https://www.googleapis.com/drive/v3/files/${newSheetId}/permissions`,
            method: "POST",
            params: {
                sendNotificationEmail: false
            },
            data: {
                role: "writer",
                type: "user",
                emailAddress: process.env.GOOGLE_OWNER_EMAIL
            }
        });
    }

    console.log(`✅ Đã tạo Google Sheet mới cho server: ${guildName}`);
    console.log(`🔗 https://docs.google.com/spreadsheets/d/${newSheetId}`);

    return newSheetId;
}

async function getDoc(guildId, guildName = "Unknown Server") {
    const auth = createAuth();
    const sheetId = await findOrCreateSheetId(guildId, guildName);

    const doc = new GoogleSpreadsheet(sheetId, auth);
    await doc.loadInfo();

    return doc;
}

async function getSheet(guildId, guildName = "Unknown Server") {
    const doc = await getDoc(guildId, guildName);
    const sheet = doc.sheetsByIndex[0];

    await sheet.setHeaderRow([
        "Tên Discord",
        "Tên nhân vật",
        "Môn phái",
        "Rank",
        "Bang Chiến",
        "Scrim",
        "Server",
        "Thời gian",
        "Discord ID Ẩn"
    ]);

    return sheet;
}

async function beautifySheet(guildId, guildName = "Unknown Server") {
    const doc = await getDoc(guildId, guildName);
    const sheet = doc.sheetsByIndex[0];
    const sheetId = sheet.sheetId;

    const requests = [
        {
            repeatCell: {
                range: {
                    sheetId,
                    startRowIndex: 0,
                    endRowIndex: 1,
                    startColumnIndex: 0,
                    endColumnIndex: 9
                },
                cell: {
                    userEnteredFormat: {
                        backgroundColor: { red: 0.12, green: 0.24, blue: 0.42 },
                        textFormat: {
                            foregroundColor: { red: 1, green: 1, blue: 1 },
                            bold: true
                        },
                        horizontalAlignment: "CENTER"
                    }
                },
                fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
            }
        },
        {
            updateSheetProperties: {
                properties: {
                    sheetId,
                    gridProperties: {
                        frozenRowCount: 1
                    }
                },
                fields: "gridProperties.frozenRowCount"
            }
        },
        {
            autoResizeDimensions: {
                dimensions: {
                    sheetId,
                    dimension: "COLUMNS",
                    startIndex: 0,
                    endIndex: 9
                }
            }
        },
        {
            updateDimensionProperties: {
                range: {
                    sheetId,
                    dimension: "COLUMNS",
                    startIndex: 8,
                    endIndex: 9
                },
                properties: {
                    hiddenByUser: true
                },
                fields: "hiddenByUser"
            }
        }
    ];

    for (const [monPhai, color] of Object.entries(monPhaiColors)) {
        requests.push({
            addConditionalFormatRule: {
                rule: {
                    ranges: [
                        {
                            sheetId,
                            startRowIndex: 1,
                            startColumnIndex: 0,
                            endColumnIndex: 9
                        }
                    ],
                    booleanRule: {
                        condition: {
                            type: "CUSTOM_FORMULA",
                            values: [
                                {
                                    userEnteredValue: `=$C2="${monPhai}"`
                                }
                            ]
                        },
                        format: {
                            backgroundColor: color
                        }
                    }
                },
                index: 0
            }
        });
    }

    await doc.batchUpdate({ requests });
}

async function saveToGoogleSheet(data) {
    const sheet = await getSheet(data.guildId, data.guildName);
    const rows = await sheet.getRows();

    const oldRow = rows.find(row => row.get("Discord ID Ẩn") === data.discordId);

    if (oldRow) {
        oldRow.set("Tên Discord", data.discordName);
        oldRow.set("Tên nhân vật", data.tenNhanVat);
        oldRow.set("Môn phái", data.monPhai);
        oldRow.set("Rank", data.rank);
        oldRow.set("Bang Chiến", data.bangChien);
        oldRow.set("Scrim", data.scrim);
        oldRow.set("Server", data.guildName);
        oldRow.set("Thời gian", data.time);
        oldRow.set("Discord ID Ẩn", data.discordId);
        await oldRow.save();
    } else {
        await sheet.addRow({
            "Tên Discord": data.discordName,
            "Tên nhân vật": data.tenNhanVat,
            "Môn phái": data.monPhai,
            "Rank": data.rank,
            "Bang Chiến": data.bangChien,
            "Scrim": data.scrim,
            "Server": data.guildName,
            "Thời gian": data.time,
            "Discord ID Ẩn": data.discordId
        });
    }

    await beautifySheet(data.guildId, data.guildName);
}

async function deleteRegistration(guildId, guildName, discordId) {
    const sheet = await getSheet(guildId, guildName);
    const rows = await sheet.getRows();

    const row = rows.find(r => r.get("Discord ID Ẩn") === discordId);

    if (!row) return false;

    await row.delete();
    await beautifySheet(guildId, guildName);

    return true;
}

async function getAllRows(guildId, guildName) {
    const sheet = await getSheet(guildId, guildName);
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

    return [row1, row2, row3];
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
        guildId: getGuildId(interaction),
        guildName: getGuildName(interaction),
        discordId: interaction.user.id,
        discordName: getDisplayName(interaction),
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
    const guildId = getGuildId(interaction);
    const guildName = getGuildName(interaction);
    const rows = await getAllRows(guildId, guildName);

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
    const guildId = getGuildId(interaction);
    const guildName = getGuildName(interaction);
    const rows = await getAllRows(guildId, guildName);

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

    const title = type === "bangchien" ? "🏰 DANH SÁCH BANG CHIẾN" : "🥊 DANH SÁCH SCRIM";

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
        { name: "taoform", description: "Tạo form đăng ký Bang Chiến" },
        { name: "dongform", description: "Đóng form đăng ký" },
        { name: "moform", description: "Mở form đăng ký" },
        { name: "thongke", description: "Xem thống kê môn phái" },
        {
            name: "xuatdanhsach",
            description: "Xuất danh sách Bang Chiến hoặc Scrim",
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
            if (!isAdmin(interaction)) {
                return interaction.reply({
                    content: "❌ Chỉ Admin mới dùng được lệnh này.",
                    ephemeral: true
                });
            }

            if (interaction.commandName === "taoform") {
                FORM_OPEN = true;

                return interaction.reply({
                    content: "📋 **ĐĂNG KÝ BANG CHIẾN**\n\nVui lòng chọn môn phái:",
                    components: createMainButtons()
                });
            }

            if (interaction.commandName === "dongform") {
                FORM_OPEN = false;

                return interaction.reply({
                    content: "🔒 Đã đóng form đăng ký.",
                    ephemeral: false
                });
            }

            if (interaction.commandName === "moform") {
                FORM_OPEN = true;

                return interaction.reply({
                    content: "✅ Đã mở lại form đăng ký.",
                    ephemeral: false
                });
            }

            if (interaction.commandName === "thongke") {
                return await sendStats(interaction);
            }

            if (interaction.commandName === "xuatdanhsach") {
                const type = interaction.options.getString("loai");
                return await sendList(interaction, type);
            }
        }

        if (interaction.isButton()) {
            if (monPhaiMap[interaction.customId]) {
                if (!FORM_OPEN) {
                    return interaction.reply({
                        content: "🔒 Form đăng ký hiện đang đóng.",
                        ephemeral: true
                    });
                }

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
                const deleted = await deleteRegistration(
                    getGuildId(interaction),
                    getGuildName(interaction),
                    interaction.user.id
                );

                return interaction.reply({
                    content: deleted ? "🗑️ Đã hủy đăng ký của bạn." : "❌ Bạn chưa có đăng ký để hủy.",
                    ephemeral: true
                });
            }

            if (interaction.customId === "stats_class") {
                return await sendStats(interaction);
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

            return interaction.reply({
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