const { EmbedBuilder } = require('discord.js');
const api = require('../../api_handler');

const dailyReward = 5000;
const cooldown = 86400000; 


/**
 * Mengubah milidetik menjadi format waktu yang mudah dibaca.
 * @param {number} duration - Durasi dalam milidetik.
 * @returns {string}
 */
function msToTime(duration) {
    const seconds = Math.floor((duration / 1000) % 60);
    const minutes = Math.floor((duration / (1000 * 60)) % 60);
    const hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

    let timeString = "";
    if (hours > 0) timeString += `${hours} Jam `;
    if (minutes > 0) timeString += `${minutes} Menit `;
    if (seconds > 0) timeString += `${seconds} Detik`;

    return timeString.trim();
}

module.exports = {
  prefix: "daily",
  category: "rpg",
  aliases: ["claim"],
  
  async execute(message, args, client) {
    const userId = message.author.id;
    const username = message.author.username;

    try {
        const userData = await api.getUser(userId, username);

        const lastClaim = userData.lastDaily || 0;
        const currentTime = Date.now();
        if (currentTime - lastClaim < cooldown) {
        const remainingTime = cooldown - (currentTime - lastClaim);
        return message.reply(`🎁 Anda sudah mengambil hadiah harian.\nSilakan kembali lagi dalam **${msToTime(remainingTime)}**.`);
    }

        userData.money += dailyReward;
        userData.lastDaily = currentTime;

        await api.updateUser(userId, userData);

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71).setTitle("🎉 Hadiah Harian Berhasil Diklaim!")
            .setDescription(`Kamu mendapatkan **${dailyReward.toLocaleString('id-ID')}** Money!`)
            .addFields({ name: 'Total Uangmu Sekarang', value: `💰 ${userData.money.toLocaleString('id-ID')}` })
            .setFooter({ text: "Kembali lagi besok!" });

        await message.reply({ embeds: [embed] });

    } catch (error) {
        console.error("[DAILY CMD ERROR]", error);
        message.reply(`❌ Terjadi kesalahan: ${error.message}`);
    }
  },
};