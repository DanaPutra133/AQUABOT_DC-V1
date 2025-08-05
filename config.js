require('dotenv').config(); // Tambahkan baris ini di paling atas file config.js

module.exports = {
  // Bot Identity
  botName: "AQUABOT", // Nama bot kamu
  ownerID: "Dana putra", // Ganti dengan Nama Kamu

 //  ======== VIRTUNIX ========
 birthdayReminder: {
  // ini buat staff h-3
    staffChannelId: "1388157961729474622", 
    staffRoleIds: [
        "1379090789451173888", 
        ""
    ], 
    
    mainChannelId: "1248939308501569540", // ID channel utama untuk ucapan ulang tahun  
    mentionRoleIds: [
        "1399565072258437150",
        "1379091171363786803"
    ], 
    
    daysInAdvance: 3 
},

  //API DATABASE RPG
  api: {
        baseUrl: "https://api.danafxc.my.id/api",   // kamu bisa dapat apikey ini dengan beli di https://api.danafxc.my.id/Price-api
        apiKey: process.env.API_KEY_DANA, 
    },

  // Discord Settings
  token: process.env.DISCORD_BOT_TOKEN, // Mengambil token dari .env
  prefix: "!", // Prefix utama untuk bot ini

  clientId:  "1388079483646509177", //client ID bot kamu
  
  //ini pakai kalau misal nya slash / command mau di 1 server aja, optional
  guildID: "", // ID server tempat bot ini berada

  //fitur braodcast yang bakal di kirim ke beberapa ch yang di input
  broadcastChannels: [
        "1294278656818024545"
    ],

    //auto DL
  autoDownload: {
        // Daftarkan semua ID SERVER tempat fitur ini boleh aktif
        enabledServers: [
            "1183981941452714065", // Ganti dengan ID SERVER (GUILD ID) Anda
            ""
        ],
        // (Opsional) Daftarkan ID CHANNEL yang ingin dikecualikan di server tersebut
        excludedChannels: [
            "", 
            ""
        ]
    },

  // API Keys
  apikey_lann: process.env.API_KEY_LANN, // Mengambil API key dari .env
// kamu bisa dapat apikey ini dengan beli di https://api.danafxc.my.id/Price-api

  apikey_dana: process.env.API_KEY_DANA, // Mengambil API key dari .env
// kamu bisa dapat apikey ini dengan beli di https://api.danafxc.my.id/Price-api

  reminderChannelIds: [
        '1391419433741979819',
        '1294278656818024545',
        // Add more channel IDs as needed
    ],
  ownerId: '686498842560168043',
  ilabChannelId: '1313549503516901447',
  // Menu & Feature Settings
  menuPublic: false, // Apakah menu public aktif?

  // Channel IDs
  joinChannelId: "1248939308501569536", // ID channel join
  gempaChannelId: "1248939308501569536", // ID channel gempa
  growgardenChannelId: "1248939308501569536", // ID channel growgarden
  channelIds: {
    rules: "1363427505889087518", // ID channel rules
    pricelist: "1363648989437759638", // ID channel pricelist
    ticket: "1363649443118973039", // ID channel ticket
    queue: "1371072797887037561", // ID channel queue
  },
};