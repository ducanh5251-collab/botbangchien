const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./bangchien.db");

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS dangky (
            discord_id TEXT PRIMARY KEY,
            ten_nhan_vat TEXT,
            mon_phai TEXT,
            bang_chien TEXT,
            scrim TEXT,
            rank TEXT,
            thoi_gian TEXT
        )
    `);
});

function saveRegistration(data) {
    return new Promise((resolve, reject) => {
        db.run(
            `
            INSERT INTO dangky
            (discord_id, ten_nhan_vat, mon_phai, bang_chien, scrim, rank, thoi_gian)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(discord_id) DO UPDATE SET
                ten_nhan_vat = excluded.ten_nhan_vat,
                mon_phai = excluded.mon_phai,
                bang_chien = excluded.bang_chien,
                scrim = excluded.scrim,
                rank = excluded.rank,
                thoi_gian = excluded.thoi_gian
            `,
            [
                data.discordId,
                data.tenNhanVat,
                data.monPhai,
                data.bangChien,
                data.scrim,
                data.rank,
                data.time
            ],
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

function getAllRegistrations() {
    return new Promise((resolve, reject) => {
        db.all(
            `
            SELECT
                ten_nhan_vat AS "Tên nhân vật",
                mon_phai AS "Môn phái",
                bang_chien AS "Bang Chiến",
                scrim AS "Scrim",
                rank AS "Rank",
                thoi_gian AS "Thời gian"
            FROM dangky
            ORDER BY mon_phai ASC
            `,
            [],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

module.exports = {
    saveRegistration,
    getAllRegistrations
};