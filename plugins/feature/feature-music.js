const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior } = require("@discordjs/voice");
const { EmbedBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const axios = require("axios");
const config = require("../../config");
const fs = require("fs");
const path = require("path");
const { spawn } = require('child_process');
const { findInCache, getCacheKey, tempDir } = require('../../cache_handler'); 
const { QueueRepeatMode } = require('discord-player'); 
const ytSearch = require("yt-search");

const queueMap = new Map();
const autoLeaveTimers = new Map();

async function fetchTrackInfo(input) {
    let trackInfo;
    
    // 1. CEK JIKA INPUT ADALAH LINK SPOTIFY
    if (/spotify\.com/i.test(input)) {
        const { data } = await axios.get(`https://api.betabotz.eu.org/api/download/spotify?url=${encodeURIComponent(input)}&apikey=${config.apikey_lann}`);
        const d = data?.result?.data;
        if (!d) throw new Error("Gagal mengambil info Spotify.");
        trackInfo = { 
            url: input, 
            title: d.title || "Spotify Track", 
            thumbnail: d.thumbnail, 
            audioUrl: d.url, 
            duration: d.duration || "-" 
        };
    } 
    // 2. CEK JIKA INPUT ADALAH LINK SOUNDCLOUD
    else if (/soundcloud\.com/i.test(input)) {
        const { data } = await axios.get(`https://api.betabotz.eu.org/api/download/soundcloud?url=${encodeURIComponent(input)}&apikey=${config.apikey_lann}`);
        const d = data?.result;
        if (!d) throw new Error("Gagal mengambil info SoundCloud.");
        trackInfo = { 
            url: input, 
            title: d.title || "SoundCloud Track", 
            thumbnail: d.thumbnail, 
            audioUrl: d.url, 
            duration: d.duration || "-" 
        };
    } 
    // 3. JIKA INPUT BERUPA LINK YOUTUBE ATAU PENCARIAN TEKS/JUDUL
    else {
        let ytVideo;
        const searchResult = await ytSearch(input);
        
        if (searchResult && searchResult.videos.length > 0) {
            ytVideo = searchResult.videos[0];
        }
        
        if (!ytVideo) {
            throw new Error("Lagu tidak ditemukan di YouTube. Coba kata kunci lain.");
        }

        const { data } = await axios.get(`https://api.betabotz.eu.org/api/download/yt?url=${encodeURIComponent(ytVideo.url)}&apikey=${config.apikey_lann}`);
        const d = data?.result;
        
        if (!d || !d.mp3) throw new Error("Gagal mengambil link audio dari server.");
        
        trackInfo = { 
            url: ytVideo.url, 
            title: ytVideo.title, 
            thumbnail: ytVideo.thumbnail, 
            audioUrl: d.mp3, 
            duration: ytVideo.timestamp || "-" 
        };
    }
    
    return trackInfo;
}

async function handleRepeat(message, args) {
    const data = queueMap.get(message.guild.id);
    if (!data) return message.reply("❌ Tidak ada musik yang sedang diputar.");

    const modeArg = args[0]?.toLowerCase();
    let newMode, modeName;
    
    if (['song', 'track'].includes(modeArg)) {
        newMode = 'song'; modeName = 'Lagu';
    } else if (['queue', 'q'].includes(modeArg)) {
        newMode = 'queue'; modeName = 'Antrian';
    } else if (modeArg === 'off') {
        newMode = 'off'; modeName = 'Mati';
    } else {
        if (data.repeatMode === 'off') { newMode = 'song'; modeName = 'Lagu'; }
        else if (data.repeatMode === 'song') { newMode = 'queue'; modeName = 'Antrian'; }
        else { newMode = 'off'; modeName = 'Mati'; }
    }

    data.repeatMode = newMode;
    const embed = new EmbedBuilder().setColor(0x2ECC71).setDescription(`🔁 Mode pengulangan diatur ke: **${modeName}**`);
    return message.reply({ embeds: [embed] });
}

function downloadAndCache(audioUrl, cachePath) {
    return new Promise(async (resolve, reject) => {
        console.log(`[Downloader] Mengunduh dari: ${audioUrl}`);
        const isYoutubeMp4 = /youtube\.com|youtu\.be|ydl\.ymcdn\.org\/api\/v1\/download\//i.test(audioUrl);
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
        let tempMp4 = null;
        try {
            if (isYoutubeMp4) {
                const tmp = require('tmp');
                tempMp4 = tmp.tmpNameSync({ postfix: '.mp4' });
                const writer = fs.createWriteStream(tempMp4);
                const response = await axios.get(audioUrl, {
                    responseType: 'stream',
                    headers: { 'User-Agent': userAgent },
                    timeout: 60000
                });
                await new Promise((res, rej) => {
                    response.data.pipe(writer);
                    writer.on('finish', res);
                    writer.on('error', rej);
                });
                const ffmpeg = spawn('ffmpeg', [
                    '-i', tempMp4,
                    '-vn',
                    '-acodec', 'libopus',
                    '-b:a', '128k',
                    '-f', 'opus',
                    cachePath,
                    '-loglevel', 'error',
                    '-y'
                ]);
                ffmpeg.on('close', (code) => {
                    try { if (fs.existsSync(tempMp4)) fs.unlinkSync(tempMp4); } catch (e) {}
                    if (code === 0) {
                        console.log(`[Cache] Berhasil menyimpan file ke: ${cachePath}`);
                        resolve(cachePath);
                    } else {
                        if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
                        reject(new Error(`FFmpeg keluar dengan kode ${code}`));
                    }
                });
                ffmpeg.stderr.on('data', data => console.error(`[FFMPEG Cache Error]: ${data.toString()}`));
                ffmpeg.on('error', err => {
                    try { if (fs.existsSync(tempMp4)) fs.unlinkSync(tempMp4); } catch (e) {}
                    reject(err);
                });
            } else {
                const ffmpeg = spawn('ffmpeg', [
                    '-i', audioUrl,
                    '-c:a', 'libopus',
                    '-b:a', '128k',
                    '-f', 'opus',
                    cachePath,
                    '-loglevel', 'error',
                    '-y'
                ]);
                ffmpeg.on('close', (code) => {
                    if (code === 0) {
                        console.log(`[Cache] Berhasil menyimpan file ke: ${cachePath}`);
                        resolve(cachePath);
                    } else {
                        if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
                        reject(new Error(`FFmpeg keluar dengan kode ${code}`));
                    }
                });
                ffmpeg.stderr.on('data', data => console.error(`[FFMPEG Cache Error]: ${data.toString()}`));
                ffmpeg.on('error', err => reject(err));
            }
        } catch (err) {
            if (tempMp4 && fs.existsSync(tempMp4)) try { fs.unlinkSync(tempMp4); } catch (e) {}
            reject(err);
        }
    });
}
 
async function playNext(guildId) {
    const data = queueMap.get(guildId);
    if (!data) return;
    if (autoLeaveTimers.has(guildId)) { clearTimeout(autoLeaveTimers.get(guildId)); autoLeaveTimers.delete(guildId); }

    if (!data.queue.length) {
        data.textChannel.send({ embeds: [new EmbedBuilder().setColor(0xe67e22).setTitle("⏳ Antrian Kosong").setDescription("Bot akan keluar dalam 3 menit jika tidak ada lagu baru.")] });
        const timer = setTimeout(() => {
            const currentData = queueMap.get(guildId);
            if (currentData?.connection?.state.status !== 'destroyed') {
                currentData.connection.destroy();
                queueMap.delete(guildId);
            }
        }, 180000);
        autoLeaveTimers.set(guildId, timer);
        return;
    }

    const track = data.queue[0];
    try {
        let streamPath = findInCache(track.url);
        
        if (!streamPath) {
            const preparingMsg = await data.textChannel.send(`📥 Mengunduh & menyimpan **${track.title}** untuk pertama kali...`);
            const cacheKey = getCacheKey(track.url);
            streamPath = await downloadAndCache(track.audioUrl, path.join(tempDir, cacheKey));
            if (preparingMsg.deletable) await preparingMsg.delete().catch(()=>{});
        }

        const resource = createAudioResource(streamPath);
        data.player.play(resource);

        let embed = new EmbedBuilder()
            .setColor(0x7289DA)
            .setTitle("▶️ Sedang Diputar")
            .setDescription(`[${track.title}](${track.url})`)
            .setFooter({ text: `Diminta oleh: ${track.user.username}`, iconURL: track.user.displayAvatarURL() });
        if (track.thumbnail && typeof track.thumbnail === 'string' && track.thumbnail.trim() !== '') {
            embed = embed.setThumbnail(track.thumbnail);
        }
        await data.textChannel.send({ embeds: [embed] });
    } catch (e) {
        console.error("Gagal memutar lagu:", e);
        data.textChannel.send(`❌ Gagal memutar **${track.title}**: ${e.message}. Melewati lagu.`);
        data.queue.shift();
        setImmediate(() => playNext(guildId));
    }
}

async function handlePlay(msg, client, args) {
  const voiceChannel = msg.member?.voice?.channel;
  if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
    return msg.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle("🔊 Masuk Voice Channel Dulu").setDescription("Kamu harus bergabung dengan voice channel terlebih dahulu!")] });
  }

  if (!args.length) {
    const helpEmbed = new EmbedBuilder()
      .setColor(0x7289DA)
      .setTitle("🎵 Panduan Perintah Musik")
      .setDescription("Berikut adalah perintah yang tersedia untuk fitur musik:\n\n" +
          "**▶️ Memutar Lagu**\n`!play <judul lagu / link>`\nBot mendukung pencarian teks dan link dari YouTube, Spotify, dan SoundCloud.\n\n" +
          "**⏯️ Kontrol Pemutaran**\n" +
          "• `!skip` - Melewatkan lagu yang sedang diputar.\n" +
          "• `!stop` - Menghentikan musik dan membersihkan antrian.\n" +
          "• `!pause` - Menjeda lagu.\n" +
          "• `!resume` - Melanjutkan lagi yang dijeda.\n" +
          "• `!repeat` - Mengubah mode pengulangan (Mati -> Lagu -> Antrian).\n" +
          "• `!fix` - Mengatasi masalah suara bot patah-patah atau macet.\n\n" +
          "**📜 Informasi Antrian**\n" +
          "• `!queue` - Menampilkan daftar lagu di antrian.\n*(Alias: `!q`, `!list`, `!playlist`, `!np`)*"
      )
      .setFooter({ text: "Gunakan perintah di atas sesuai kebutuhan Anda." });
    return msg.reply({ embeds: [helpEmbed] });
  }

  const input = args.join(" ");
  const loadingMsg = await msg.channel.send("🔍 Mencari lagu...");
    try {
        const trackInfo = await fetchTrackInfo(input);
        await loadingMsg.delete().catch(()=>{});

        const guildId = msg.guild.id;
        if (!queueMap.has(guildId)) {
            const connection = joinVoiceChannel({ channelId: voiceChannel.id, guildId, adapterCreator: msg.guild.voiceAdapterCreator, selfDeaf: true });
            const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
            connection.subscribe(player);
            const data = { queue: [], player, connection, textChannel: msg.channel };
            queueMap.set(guildId, data);
             player.on(AudioPlayerStatus.Idle, () => {
                const currentData = queueMap.get(guildId);
                if (!currentData) return;

                const lastTrack = currentData.queue[0];
                
                if (currentData.repeatMode === 'song') {
                    // Jangan shift queue, lagu yang sama akan diputar ulang
                } else if (currentData.repeatMode === 'queue' && lastTrack) {
                    currentData.queue.push(currentData.queue.shift());
                } else {
                    currentData.queue.shift();
                }
                
                playNext(guildId);
            });
            player.on("error", (err) => { console.error(`[Player Error]:`, err); data.textChannel.send(`⚠️ Terjadi kesalahan playback.`); });
        }

        const data = queueMap.get(guildId);
        const track = { ...trackInfo, user: msg.author };
        data.queue.push(track);
        
        if (data.player.state.status !== AudioPlayerStatus.Playing) {
            await playNext(guildId);
        } else {
            const embed = new EmbedBuilder()
                .setColor(0x1abc9c)
                .setTitle("🎶 Lagu Ditambahkan ke Antrian")
                .setDescription(`[${track.title}](${track.url})`)
                .setThumbnail(track.thumbnail)
                .addFields({ name: "Posisi di antrian", value: `${data.queue.length - 1}` }); 
            await msg.channel.send({ embeds: [embed] });
        }
    } catch (e) {
        await loadingMsg.edit(`❌ Gagal memproses lagu: ${e.message}`);
    }
}

async function handleSkip(msg) {
    const data = queueMap.get(msg.guild.id);
    if (!data || data.queue.length === 0) {
        return msg.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle("⏭️ Tidak Ada Lagu").setDescription("Tidak ada lagu di antrian untuk dilewati.")] });
    }
    const isLastSong = data.queue.length === 1;
    let replyMessage = "Lagu saat ini telah diskip.";
    if (isLastSong) {
        replyMessage = "Lagu terakhir telah diskip. Antrian sekarang kosong.";
    }
    data.player.stop(true);
    msg.channel.send({ embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle("⏭️ Lagu Diskip").setDescription(replyMessage)] });
}

async function handleQueue(msg) {
    const data = queueMap.get(msg.guild.id);
    if (!data || data.queue.length === 0) {
        return msg.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle("📜 Antrian Kosong").setDescription("Tidak ada musik yang sedang diputar atau diantrekan.")] });
    }
    const currentTrack = data.queue[0];
    const upcomingTracks = data.queue.slice(1);
    const embed = new EmbedBuilder()
        .setColor(0x00bfff)
        .setTitle(`📜 Daftar Antrian Musik (${data.queue.length} Lagu)`)
        .setThumbnail(currentTrack.thumbnail)
        .addFields({ name: "▶️ Sedang Diputar", value: `[${currentTrack.title}](${currentTrack.url})\n**Durasi:** \`${currentTrack.duration}\` | **Diminta oleh:** <@${currentTrack.user.id}>` });
    
    if (upcomingTracks.length > 0) {
        const queueString = upcomingTracks.slice(0, 10).map((t, i) => `\`${i + 1}.\` [${t.title}](${t.url}) | \`${t.duration}\``).join('\n');
        const footerString = upcomingTracks.length > 10 ? `\n...dan ${upcomingTracks.length - 10} lagu lainnya.` : '';
        embed.addFields({ name: "⬇️ Berikutnya di Antrian", value: queueString + footerString });
    } else {
        embed.addFields({ name: "⬇️ Berikutnya di Antrian", value: "Tidak ada lagu lain di antrian." });
    }
    msg.channel.send({ embeds: [embed] });
}

async function handleStop(msg) {
    const guildId = msg.guild.id;
    const data = queueMap.get(guildId);
    if (!data) return;
    data.queue = [];
    data.player?.stop(true);
    if (data.connection?.state.status !== 'destroyed') data.connection?.destroy();
    queueMap.delete(guildId);
    if (autoLeaveTimers.has(guildId)) { clearTimeout(autoLeaveTimers.get(guildId)); autoLeaveTimers.delete(guildId); }
    msg.channel.send({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle("🛑 Antrian Dihentikan").setDescription("Antrian dibersihkan dan bot keluar dari voice channel.")] });
}

async function handlePause(msg) {
    const data = queueMap.get(msg.guild.id);
    if (!data || data.player.state.status !== AudioPlayerStatus.Playing) return msg.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle("⏸️ Tidak Ada Lagu").setDescription("Tidak ada lagu yang sedang diputar.")] });
    data.player.pause();
    msg.channel.send({ embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle("⏸️ Playback Dijeda")] });
}

async function handleResume(msg) {
    const data = queueMap.get(msg.guild.id);
    if (!data || data.player.state.status !== AudioPlayerStatus.Paused) return msg.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle("▶️ Tidak Ada Lagu").setDescription("Tidak ada lagu yang sedang dijeda.")] });
    data.player.unpause();
    msg.channel.send({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle("▶️ Playback Dilanjutkan")] });
}

// ==================== FITUR AUDIO FIX ====================
async function handleFix(msg) {
    const guildId = msg.guild.id;
    const data = queueMap.get(guildId);

    if (!data || !data.connection) {
        return msg.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle("❌ Tidak Ada Sesi Musik").setDescription("Bot sedang tidak memutar musik di server ini.")] });
    }

    const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("🛠️ Audio Troubleshooting")
        .setDescription("Jika suara bot patah-patah, lag, atau macet, silakan pilih salah satu opsi di bawah ini:\n\n" +
            "🔄 **Reconnect**: Bot akan memancing ulang sinyal voice tanpa menghapus antrian.\n" +
            "♻️ **Reset Player**: Mereset pemutar musik dan mengulang lagu yang sedang diputar (Mulai dari 0:00).\n" +
            "🛑 **Disconnect**: Menghentikan bot secara paksa dan membuang semua antrian."
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('fix_reconnect').setLabel('Reconnect').setStyle(ButtonStyle.Primary).setEmoji('🔄'),
        new ButtonBuilder().setCustomId('fix_reset').setLabel('Reset Player').setStyle(ButtonStyle.Secondary).setEmoji('♻️'),
        new ButtonBuilder().setCustomId('fix_disconnect').setLabel('Disconnect').setStyle(ButtonStyle.Danger).setEmoji('🛑')
    );

    const replyMsg = await msg.reply({ embeds: [embed], components: [row] });

    // Menyaring agar hanya user yang memanggil command yang bisa klik tombolnya (aktif selama 60 detik)
    const collector = replyMsg.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async (interaction) => {
        if (interaction.user.id !== msg.author.id) {
            return interaction.reply({ content: "❌ Hanya yang mengetik command yang bisa memencet tombol ini.", ephemeral: true });
        }

        const currentData = queueMap.get(guildId);
        if (!currentData || !currentData.connection) {
            return interaction.update({ content: "❌ Sesi musik sudah berakhir.", embeds: [], components: [] });
        }

        if (interaction.customId === 'fix_reconnect') {
            await interaction.deferUpdate();
            try {
                // Proses re-join jaringan suara untuk merefresh jalur UDP Discord
                const voiceChannelId = currentData.connection.joinConfig.channelId;
                currentData.connection.destroy();
                
                const newConnection = joinVoiceChannel({
                    channelId: voiceChannelId,
                    guildId: guildId,
                    adapterCreator: msg.guild.voiceAdapterCreator,
                    selfDeaf: true
                });
                newConnection.subscribe(currentData.player);
                currentData.connection = newConnection;

                await interaction.followUp({ content: "✅ Berhasil **Reconnect** ke Voice Channel. Suara seharusnya sudah lancar.", ephemeral: true });
            } catch (e) {
                await interaction.followUp({ content: "❌ Gagal reconnect.", ephemeral: true });
            }
        } 
        else if (interaction.customId === 'fix_reset') {
            await interaction.deferUpdate();
            const track = currentData.queue[0];
            if (track) {
                // Menduplikat lagu saat ini ke antrian terdepan lagi agar bisa di-trigger ulang
                currentData.queue.unshift(track);
                currentData.player.stop(true); // Memancing event AudioPlayerStatus.Idle
                await interaction.followUp({ content: "♻️ **Player Direset**. Lagu sedang dimuat ulang...", ephemeral: true });
            } else {
                await interaction.followUp({ content: "❌ Tidak ada lagu yang bisa direset.", ephemeral: true });
            }
        } 
        else if (interaction.customId === 'fix_disconnect') {
            await interaction.deferUpdate();
            currentData.queue = [];
            currentData.player?.stop(true);
            if (currentData.connection?.state.status !== 'destroyed') currentData.connection?.destroy();
            queueMap.delete(guildId);
            await interaction.followUp({ content: "🛑 Bot berhasil **Disconnect** dan antrian dibersihkan.", ephemeral: true });
            collector.stop();
        }
    });

    collector.on('end', () => {
        replyMsg.edit({ components: [] }).catch(()=>{});
    });
}

module.exports = {
  prefix: "play",
  aliases: ["music", "musik", "p"],
  category: "feature",
  execute: async (msg, args, client) => {
    await handlePlay(msg, client, args);
  },
  subCommands: {
    skip: { handler: handleSkip, aliases: ["s"] },
    stop: { handler: handleStop, aliases: ["end", "quit", "leave", "dc"] },
    pause: { handler: handlePause, aliases: [] },
    resume: { handler: handleResume, aliases: ["continue"] },
    queue: { handler: handleQueue, aliases: ["q", "list", "playlist", "np", "nowplaying"] },
    repeat: { handler: handleRepeat, aliases: ["loop"] },
    fix: { handler: handleFix, aliases: ["repair"] } // <-- COMMAND FIX SUDAH TERSAMBUNG
  },
};