// 🛠️ Panduan Migrasi / Deployment
// 1. **Hapus File Lama:** Hapus file `ban.js` yang lama di dalam folder `plugins/tools/` agar tidak terjadi bentrok *command* (double trigger).
// 2. **Tambahkan File Baru:** Masukkan file `moderator.js` yang baru ini ke dalam folder `plugins/tools/`.
// ATAU
// 1. **Rename File `ban.js` menjadi `moderator.js` dan Timpa kdoe baru ini ke dalamnya.** Pastikan untuk mengganti nama file dengan benar agar bot dapat mengenali command baru ini.
// By NinipGanteng

const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const config = require('../../config.js');
const fs = require('fs');
const path = require('path');

// Path menuju file lokal JSON kamu
const banFilePath = path.join(__dirname, '../../banned_users.json');

module.exports = {
    prefix: "mod", 
    aliases: [
        // Moderasi Server
        "kick", "ban", "unban", "mute", "timeout", "unmute", 
        "addrole", "removerole", "clearrole", "massremoverole", 
        "clear", "purge", "lock", "unlock",
        // Moderasi Bot (Local Storage)
        "botban", "unbotban", "banlist"
    ],

    async execute(message, args, client, commandName) {
        if (!message.guild) return;

        const cmd = (commandName || "").toLowerCase();

        try {
            switch (cmd) {
                // 1. KICK (Server)
                case "kick": {
                    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) 
                        return message.reply("❌ Kamu tidak memiliki izin (`KICK_MEMBERS`).");

                    const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
                    if (!target) return message.reply("⚠️ Tag user atau masukkan ID.\n**Contoh:** `!kick @user Alasan`");

                    if (target.id === message.author.id) return message.reply("❌ Gak bisa kick diri sendiri.");
                    if (target.id === client.user.id) return message.reply("❌ Aku gak bisa kick diriku sendiri.");
                    if (message.member.roles.highest.position <= target.roles.highest.position && message.author.id !== message.guild.ownerId) {
                        return message.reply("❌ Tidak bisa kick orang yang posisinya setara/lebih tinggi darimu.");
                    }

                    const reason = args.slice(1).join(" ") || "Tidak ada alasan.";
                    await target.kick(reason);

                    const embed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle("🔨 Member Kicked")
                        .setDescription(`✅ Berhasil mengeluarkan **${target.user.tag}**.\n**Alasan:** ${reason}`);
                    return message.reply({ embeds: [embed] });
                }

                // 2. BAN (Server)
                case "ban": {
                    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) 
                        return message.reply("❌ Kamu tidak memiliki izin (`BAN_MEMBERS`).");

                    const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
                    if (!target) return message.reply("⚠️ Tag user atau masukkan ID.\n**Contoh:** `!ban @user Rusuh`");

                    if (target.id === message.author.id) return message.reply("❌ Jangan ban dirimu sendiri.");
                    if (message.member.roles.highest.position <= target.roles.highest.position && message.author.id !== message.guild.ownerId) {
                        return message.reply("❌ Tidak bisa ban orang yang posisinya setara/lebih tinggi darimu.");
                    }

                    const reason = args.slice(1).join(" ") || "Tidak ada alasan.";
                    await target.ban({ reason: reason });

                    const embed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle("🔨 Member Banned (Server)")
                        .setDescription(`✅ Berhasil mem-ban **${target.user.tag}** dari server.\n**Alasan:** ${reason}`);
                    return message.reply({ embeds: [embed] });
                }

                // 3. UNBAN (Server)
                case "unban": {
                    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) 
                        return message.reply("❌ Kamu tidak memiliki izin (`BAN_MEMBERS`).");

                    const userId = args[0];
                    if (!userId) return message.reply("⚠️ Masukkan ID user yang ingin di-unban.\n**Contoh:** `!unban 1234567890`");

                    await message.guild.members.unban(userId);
                    const embed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle("🕊️ Member Unbanned (Server)")
                        .setDescription(`✅ Berhasil membuka ban server untuk user ID: **${userId}**.`);
                    return message.reply({ embeds: [embed] });
                }

                // 4. MUTE / TIMEOUT
                case "mute":
                case "timeout": {
                    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) 
                        return message.reply("❌ Kamu tidak memiliki izin (`MODERATE_MEMBERS`).");

                    const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
                    if (!target) return message.reply("⚠️ Tag user yang ingin di-mute.\n**Contoh:** `!mute @user 10 Berisik` *(10 = 10 menit)*");

                    if (message.member.roles.highest.position <= target.roles.highest.position && message.author.id !== message.guild.ownerId) {
                        return message.reply("❌ Tidak bisa mute orang yang posisinya setara/lebih tinggi darimu.");
                    }

                    const durationInput = parseInt(args[1]);
                    const minutes = isNaN(durationInput) ? 5 : durationInput; 
                    const msDuration = minutes * 60 * 1000; 
                    
                    const reasonStartIndex = isNaN(durationInput) ? 1 : 2;
                    const reason = args.slice(reasonStartIndex).join(" ") || "Tidak ada alasan.";

                    await target.timeout(msDuration, reason);

                    const embed = new EmbedBuilder()
                        .setColor(0xFFA500)
                        .setTitle("🔇 Member Muted (Timeout)")
                        .setDescription(`✅ **${target.user.tag}** di-timeout selama **${minutes} menit**.\n**Alasan:** ${reason}`);
                    return message.reply({ embeds: [embed] });
                }

                // 5. UNMUTE
                case "unmute": {
                    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) 
                        return message.reply("❌ Kamu tidak memiliki izin (`MODERATE_MEMBERS`).");

                    const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
                    if (!target) return message.reply("⚠️ Tag user yang ingin di-unmute.\n**Contoh:** `!unmute @user`");

                    await target.timeout(null); 
                    return message.reply(`✅ Berhasil mencabut mute dari **${target.user.username}**.`);
                }

                // 6. ADD ROLE
                case "addrole": {
                    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) 
                        return message.reply("❌ Kamu tidak memiliki izin (`MANAGE_ROLES`).");

                    const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
                    const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);

                    if (!target || !role) return message.reply("⚠️ Format salah!\n**Contoh:** `!addrole @user @role`");

                    if (message.member.roles.highest.position <= role.position && message.author.id !== message.guild.ownerId) {
                        return message.reply("❌ Tidak bisa memberikan role yang posisinya lebih tinggi atau sama dengan role tertinggimu.");
                    }

                    await target.roles.add(role);
                    return message.reply(`✅ Berhasil memberikan role **${role.name}** kepada **${target.user.username}**.`);
                }

                // 7. REMOVE ROLE
                case "removerole": {
                    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) 
                        return message.reply("❌ Kamu tidak memiliki izin (`MANAGE_ROLES`).");

                    const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
                    const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);

                    if (!target || !role) return message.reply("⚠️ Format salah!\n**Contoh:** `!removerole @user @role`");

                    if (message.member.roles.highest.position <= role.position && message.author.id !== message.guild.ownerId) {
                        return message.reply("❌ Tidak bisa mencabut role yang posisinya lebih tinggi atau sama dengan role tertinggimu.");
                    }

                    await target.roles.remove(role);
                    return message.reply(`✅ Berhasil mencabut role **${role.name}** dari **${target.user.username}**.`);
                }

                // 8. CLEAR ROLE MASSAL
                case "clearrole":
                case "massremoverole": {
                    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) 
                        return message.reply("❌ Kamu tidak memiliki izin (`MANAGE_ROLES`).");

                    const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
                    if (!role) return message.reply("⚠️ Format salah! Tag role yang ingin dicabut dari semua member.\n**Contoh:** `!clearrole @ptpt`");

                    if (message.member.roles.highest.position <= role.position && message.author.id !== message.guild.ownerId) {
                        return message.reply("❌ Tidak bisa membersihkan role yang posisinya lebih tinggi atau sama dengan role tertinggimu.");
                    }

                    const loadingMsg = await message.reply(`⏳ Sedang mencari dan mencabut role **${role.name}** dari semua member... Mohon tunggu.`);

                    await message.guild.members.fetch();
                    const membersWithRole = message.guild.members.cache.filter(m => m.roles.cache.has(role.id));

                    if (membersWithRole.size === 0) {
                        return loadingMsg.edit(`⚠️ Tidak ada satupun member yang sedang memiliki role **${role.name}** saat ini.`);
                    }

                    let successCount = 0;
                    let failCount = 0;

                    for (const [memberId, member] of membersWithRole) {
                        try {
                            await member.roles.remove(role);
                            successCount++;
                        } catch (err) {
                            failCount++;
                        }
                    }

                    const embed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle("🗑️ Mass Role Removed")
                        .setDescription(`✅ Selesai!\nBerhasil mencabut role **${role.name}** dari **${successCount}** member.`)
                        .setFooter({ text: failCount > 0 ? `Gagal pada ${failCount} member (cek izin/hierarki role).` : "Seluruh member berhasil dibersihkan." });

                    return loadingMsg.edit({ content: null, embeds: [embed] });
                }

                // 9. CLEAR / PURGE CHAT
                case "clear":
                case "purge": {
                    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) 
                        return message.reply("❌ Kamu tidak memiliki izin (`MANAGE_MESSAGES`).");

                    const amount = parseInt(args[0]);
                    if (isNaN(amount) || amount < 1 || amount > 100) {
                        return message.reply("⚠️ Masukkan angka 1 sampai 100.\n**Contoh:** `!clear 50`");
                    }

                    const deleted = await message.channel.bulkDelete(amount, true);
                    const msg = await message.channel.send(`🧹 Berhasil menghapus **${deleted.size}** pesan.`);
                    
                    setTimeout(() => msg.delete().catch(() => {}), 3000);
                    break;
                }

                // 10. LOCK CHANNEL
                case "lock": {
                    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) 
                        return message.reply("❌ Kamu tidak memiliki izin (`MANAGE_CHANNELS`).");

                    await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
                    
                    const embed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle("🔒 Channel Dikunci")
                        .setDescription("Channel ini telah dikunci oleh Moderator. Member biasa tidak dapat mengirim pesan.");
                    return message.reply({ embeds: [embed] });
                }

                // 11. UNLOCK CHANNEL
                case "unlock": {
                    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) 
                        return message.reply("❌ Kamu tidak memiliki izin (`MANAGE_CHANNELS`).");

                    await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
                    
                    const embed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle("🔓 Channel Dibuka")
                        .setDescription("Channel ini telah dibuka kembali. Silakan berinteraksi seperti biasa.");
                    return message.reply({ embeds: [embed] });
                }

                // 12. BOT BAN LOKAL (Khusus Owner)
                case "botban": {
                    if (message.author.id !== config.ownerId) return message.reply("⛔ Perintah ini hanya untuk Owner Bot!");
                    
                    const targetUser = message.mentions.users.first();
                    const reason = args.slice(1).join(' ') || "Tidak ada alasan.";
                    
                    if (!targetUser) return message.reply("⚠️ Mention pengguna yang ingin diban dari bot. Contoh: `!botban @user spam`");
                    if (targetUser.id === config.ownerId) return message.reply("❌ Anda tidak bisa mem-ban diri sendiri.");
                    
                    let bannedData = {};
                    if (fs.existsSync(banFilePath)) {
                        bannedData = JSON.parse(fs.readFileSync(banFilePath, 'utf-8'));
                    }

                    if (bannedData[targetUser.id]) {
                        return message.reply(`❗ Pengguna **${targetUser.username}** sudah ada di dalam daftar ban lokal.`);
                    }

                    // Tulis data ban ke JSON Lokal
                    bannedData[targetUser.id] = {
                        username: targetUser.username,
                        reason: reason,
                        bannedAt: new Date().toISOString()
                    };
                    fs.writeFileSync(banFilePath, JSON.stringify(bannedData, null, 2));

                    // Memperbarui memory banManager secara dinamis agar bot tidak perlu restart
                    try {
                        const banManager = require('../../banManager.js');
                        if (typeof banManager.addBan === 'function') {
                            banManager.addBan(targetUser, reason);
                        }
                    } catch (e) {
                        // Abaikan jika banManager tidak dapat di-require dengan baik
                    }

                    return message.reply(`✅ Pengguna **${targetUser.username}** telah berhasil diblokir secara lokal dari penggunaan bot.`);
                }

                // 13. BOT UNBAN LOKAL (Khusus Owner)
                case "unbotban": {
                    if (message.author.id !== config.ownerId) return message.reply("⛔ Perintah ini hanya untuk Owner Bot!");
                    
                    const targetUser = message.mentions.users.first();
                    if (!targetUser) return message.reply("⚠️ Mention pengguna yang ingin di-unban dari bot. Contoh: `!unbotban @user`");
                    
                    let bannedData = {};
                    if (fs.existsSync(banFilePath)) {
                        bannedData = JSON.parse(fs.readFileSync(banFilePath, 'utf-8'));
                    }
                    
                    if (!bannedData[targetUser.id]) {
                        return message.reply(`❗ Pengguna **${targetUser.username}** tidak ditemukan di dalam daftar ban lokal.`);
                    }
                    
                    // Hapus data dari JSON Lokal
                    delete bannedData[targetUser.id];
                    fs.writeFileSync(banFilePath, JSON.stringify(bannedData, null, 2));

                    // Memperbarui memory banManager secara dinamis
                    try {
                        const banManager = require('../../banManager.js');
                        if (typeof banManager.removeBan === 'function') {
                            banManager.removeBan(targetUser);
                        }
                    } catch (e) {}

                    return message.reply(`✅ Pengguna **${targetUser.username}** telah berhasil di-unban dari data lokal bot.`);
                }

                // 14. BANLIST LOKAL (Khusus Owner)
                case "banlist": {
                    if (message.author.id !== config.ownerId) return message.reply("⛔ Perintah ini hanya untuk Owner Bot!");
                    
                    let bannedData = {};
                    if (fs.existsSync(banFilePath)) {
                        bannedData = JSON.parse(fs.readFileSync(banFilePath, 'utf-8'));
                    }

                    const bannedEntries = Object.entries(bannedData);

                    if (bannedEntries.length === 0) {
                        return message.reply("✅ Daftar ban bot lokal kosong.");
                    }

                    const description = bannedEntries.map(([id, data], index) => 
                        `${index + 1}. **${data.username || 'Unknown'}** (\`${id}\`)\n   Alasan: *${data.reason || 'Tidak ada'}*`
                    ).join('\n\n');

                    const embed = new EmbedBuilder()
                        .setColor(0xE74C3C)
                        .setTitle(`🚫 Daftar Pengguna Diblokir Lokal (${bannedEntries.length})`)
                        .setDescription(description);
                    
                    return message.reply({ embeds: [embed] });
                }
            }
        } catch (error) {
            console.error(`[MODERATOR ERROR - ${cmd}]`, error);
            
            let errorMsg = `❌ Terjadi kesalahan saat menjalankan command **${cmd}**.\nPastikan peran bot lebih tinggi dari member/role yang dituju.`;
            if (error.code === 50013) errorMsg = "❌ Bot tidak memiliki izin/hierarki yang cukup untuk melakukan tindakan ini!";
            
            message.reply(errorMsg).catch(() => {});
        }
    }
};