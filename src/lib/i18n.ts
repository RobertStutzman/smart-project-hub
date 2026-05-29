// Lightweight static-label localization keyed off navigator.language.
// Falls back to English. Used only for short UI words; long copy stays English.

type Dict = Record<string, string>;

const STRINGS: Record<string, Dict> = {
  en: {
    join: "Join",
    wait: "Wait",
    points: "Points",
    leave: "Leave",
    player: "Player",
    audience: "Audience",
    score: "Score",
    waiting_host: "Waiting for the host to start…",
    next_round_soon: "See the TV for standings — next round soon.",
    answer_eliminated: "ANSWER ELIMINATED!",
    choose_again: "CHOOSE AGAIN",
    host_disconnected: "Host disconnected",
    nickname: "Nickname",
    streamer_mode: "Streamer mode",
    twitch_channel: "Twitch channel",
    connect: "Connect",
    disconnect: "Disconnect",
    high_contrast: "High contrast",
    dyslexia_font: "Dyslexia font",
  },
  es: {
    join: "Unirse",
    wait: "Esperar",
    points: "Puntos",
    leave: "Salir",
    player: "Jugador",
    audience: "Público",
    score: "Puntaje",
    waiting_host: "Esperando al anfitrión…",
    next_round_soon: "Mira la TV — próxima ronda pronto.",
    answer_eliminated: "¡RESPUESTA ELIMINADA!",
    choose_again: "ELIGE OTRA",
    host_disconnected: "Anfitrión desconectado",
    nickname: "Apodo",
    streamer_mode: "Modo streamer",
    twitch_channel: "Canal de Twitch",
    connect: "Conectar",
    disconnect: "Desconectar",
    high_contrast: "Alto contraste",
    dyslexia_font: "Fuente dislexia",
  },
  fr: {
    join: "Rejoindre",
    wait: "Attendre",
    points: "Points",
    leave: "Quitter",
    player: "Joueur",
    audience: "Public",
    score: "Score",
    waiting_host: "En attente de l'hôte…",
    next_round_soon: "Regarde la TV — prochain tour bientôt.",
    answer_eliminated: "RÉPONSE ÉLIMINÉE !",
    choose_again: "RECHOISIS",
    host_disconnected: "Hôte déconnecté",
    nickname: "Pseudo",
    streamer_mode: "Mode streamer",
    twitch_channel: "Chaîne Twitch",
    connect: "Connecter",
    disconnect: "Déconnecter",
    high_contrast: "Contraste élevé",
    dyslexia_font: "Police dyslexie",
  },
  de: {
    join: "Beitreten",
    wait: "Warten",
    points: "Punkte",
    leave: "Verlassen",
    player: "Spieler",
    audience: "Publikum",
    score: "Punktestand",
    waiting_host: "Warten auf den Host…",
    next_round_soon: "Schau auf den TV — nächste Runde kommt.",
    answer_eliminated: "ANTWORT ELIMINIERT!",
    choose_again: "WÄHL ERNEUT",
    host_disconnected: "Host getrennt",
    nickname: "Nickname",
    streamer_mode: "Streamer-Modus",
    twitch_channel: "Twitch-Kanal",
    connect: "Verbinden",
    disconnect: "Trennen",
    high_contrast: "Hoher Kontrast",
    dyslexia_font: "Dyslexie-Schrift",
  },
  pt: {
    join: "Entrar",
    wait: "Aguardar",
    points: "Pontos",
    leave: "Sair",
    player: "Jogador",
    audience: "Público",
    score: "Pontuação",
    waiting_host: "Esperando o anfitrião…",
    next_round_soon: "Veja a TV — próxima rodada em breve.",
    answer_eliminated: "RESPOSTA ELIMINADA!",
    choose_again: "ESCOLHA OUTRA",
    host_disconnected: "Anfitrião desconectado",
    nickname: "Apelido",
    streamer_mode: "Modo streamer",
    twitch_channel: "Canal da Twitch",
    connect: "Conectar",
    disconnect: "Desconectar",
    high_contrast: "Alto contraste",
    dyslexia_font: "Fonte de dislexia",
  },
  it: {
    join: "Entra",
    wait: "Aspetta",
    points: "Punti",
    leave: "Esci",
    player: "Giocatore",
    audience: "Pubblico",
    score: "Punteggio",
    waiting_host: "In attesa dell'host…",
    next_round_soon: "Guarda la TV — prossimo round a breve.",
    answer_eliminated: "RISPOSTA ELIMINATA!",
    choose_again: "RISCEGLI",
    host_disconnected: "Host disconnesso",
    nickname: "Nickname",
    streamer_mode: "Modalità streamer",
    twitch_channel: "Canale Twitch",
    connect: "Connetti",
    disconnect: "Disconnetti",
    high_contrast: "Alto contrasto",
    dyslexia_font: "Font dislessia",
  },
  ja: {
    join: "参加",
    wait: "待機",
    points: "ポイント",
    leave: "退出",
    player: "プレイヤー",
    audience: "観客",
    score: "スコア",
    waiting_host: "ホストの開始を待っています…",
    next_round_soon: "TVを見て — 次のラウンドはまもなく。",
    answer_eliminated: "回答が消去された!",
    choose_again: "もう一度選んで",
    host_disconnected: "ホストが切断されました",
    nickname: "ニックネーム",
    streamer_mode: "配信モード",
    twitch_channel: "Twitch チャンネル",
    connect: "接続",
    disconnect: "切断",
    high_contrast: "ハイコントラスト",
    dyslexia_font: "ディスレクシアフォント",
  },
};

function detectLang(): string {
  if (typeof navigator === "undefined") return "en";
  const raw = (navigator.language || "en").toLowerCase();
  const short = raw.split("-")[0];
  return STRINGS[short] ? short : "en";
}

let cached: Dict | null = null;
function dict(): Dict {
  if (cached) return cached;
  const lang = detectLang();
  cached = { ...STRINGS.en, ...(STRINGS[lang] ?? {}) };
  return cached;
}

export function t(key: keyof (typeof STRINGS)["en"] | string): string {
  return dict()[key as string] ?? (STRINGS.en[key as string] ?? (key as string));
}

export function currentLang(): string {
  return detectLang();
}
