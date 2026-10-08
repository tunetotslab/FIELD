export const DAILY_MISSION_COUNT = 100;

const missions = {
  en: {
    starts: [
      "Record", "Find and record", "Catch before it escapes", "Go hunting for",
      "Give sixty seconds of fame to", "Turn your microphone toward", "Collect",
      "Make a tiny documentary about", "Listen closely and capture", "Rescue from silence",
    ],
    sounds: [
      "a sound hiding behind a closed door", "the quietest machine you can reach",
      "a rhythm nobody is playing on purpose", "water that is nowhere near a tap",
      "something older than you that still makes noise", "today's least beautiful sound",
      "a sound that changes when you move closer", "three objects arguing in the same room",
      "the farthest sound your ears can find", "an ordinary object pretending to be an instrument",
    ],
    endings: [
      "Give it one effect and see whether it becomes polite.",
      "Trim it brutally; the sound will probably forgive you.",
      "Add up to three effects and build it a suspicious little costume.",
      "Play it backwards and check whether it knows any secrets.",
      "Choose three emojis that would confuse an archaeologist.",
      "Give it a title worthy of a very small experimental album.",
      "Keep ten seconds that feel like the beginning of a film nobody has made.",
      "Try a strange FX mix, but leave one recognizable crumb of reality.",
      "Save it privately or let its city hear it in FIELD World.",
      "If a kettle joins in, it automatically becomes the producer.",
    ],
  },
  ru: {
    starts: [
      "Запиши", "Найди и запиши", "Поймай, пока не убежал,", "Устрой звуковую охоту на",
      "Подари шестьдесят секунд славы звуку:", "Поверни микрофон в сторону звука:", "Собери",
      "Сними крошечный звуковой документальный фильм про", "Прислушайся и поймай",
      "Спаси от тишины",
    ],
    sounds: [
      "звук, спрятавшийся за закрытой дверью", "самый тихий механизм, до которого можешь добраться",
      "ритм, который никто не играет специально", "воду, которая находится далеко от крана",
      "что-нибудь старше тебя, но всё ещё шумное", "самый некрасивый звук сегодняшнего дня",
      "звук, меняющийся при приближении", "три предмета, спорящие в одной комнате",
      "самый далёкий звук, который найдут твои уши", "обычный предмет, притворяющийся музыкальным инструментом",
    ],
    endings: [
      "Добавь один эффект и проверь, станет ли он воспитаннее.",
      "Безжалостно обрежь лишнее — звук, скорее всего, тебя простит.",
      "Добавь до трёх эффектов и собери ему подозрительный маленький костюм.",
      "Разверни его задом наперёд и проверь, не хранит ли он секреты.",
      "Выбери три эмодзи, которые поставили бы археолога в тупик.",
      "Дай ему название, достойное очень маленького экспериментального альбома.",
      "Оставь десять секунд, похожих на начало фильма, которого никто не снял.",
      "Смешай эффекты странно, но оставь хотя бы крошку узнаваемой реальности.",
      "Сохрани его лично или отпусти его город слушать FIELD World.",
      "Если в запись влез чайник, он автоматически становится продюсером.",
    ],
  },
  hy: {
    starts: [
      "Ձայնագրիր", "Գտիր և ձայնագրիր", "Բռնիր, քանի դեռ չի փախել,", "Ձայնային որս կազմակերպիր՝ գտնելու",
      "Վաթսուն վայրկյան փառք նվիրիր", "Խոսափողը շրջիր դեպի", "Հավաքիր",
      "Փոքրիկ ձայնային վավերագրություն նկարիր", "Ուշադիր լսիր ու բռնիր", "Լռությունից փրկիր",
    ],
    sounds: [
      "փակ դռան հետևում թաքնված ձայնը", "քեզ հասանելի ամենալուռ սարքի ձայնը",
      "ռիթմը, որը ոչ ոք միտումնավոր չի նվագում", "ջրի ձայնը՝ ծորակից հեռու",
      "քեզնից հին, բայց դեռ աղմկող մի բան", "այսօրվա ամենատգեղ ձայնը",
      "ձայնը, որը փոխվում է մոտենալիս", "մի սենյակում վիճող երեք առարկայի ձայները",
      "ամենահեռու ձայնը, որ ականջներդ կարող են գտնել", "երաժշտական գործիք ձևացող սովորական առարկայի ձայնը",
    ],
    endings: [
      "Ավելացրու մեկ էֆեկտ և տես՝ ավելի քաղաքավարի դարձա՞վ։",
      "Անխնա կտրիր ավելորդը․ ձայնը հավանաբար կների քեզ։",
      "Ավելացրու մինչև երեք էֆեկտ և հագցրու կասկածելի փոքրիկ զգեստ։",
      "Շրջիր այն հակառակ և ստուգիր՝ գաղտնիքներ գիտի՞։",
      "Ընտրիր երեք էմոջի, որոնք կշփոթեցնեին հնագետին։",
      "Տուր անուն, որն արժանի է շատ փոքր փորձարարական ալբոմի։",
      "Թող տասը վայրկյան, որոնք չնկարահանված ֆիլմի սկիզբ են հիշեցնում։",
      "Տարօրինակ խառնիր էֆեկտները, բայց պահիր իրականության մի փշուր։",
      "Պահիր անձնական կամ թող քաղաքը լսի այն FIELD World-ում։",
      "Եթե թեյնիկը միանա ձայնագրությանը, ինքնաբերաբար պրոդյուսեր է դառնում։",
    ],
  },
  "zh-TW": {
    starts: [
      "錄下", "找到並錄下", "趁它逃走前抓住", "來一場聲音狩獵，尋找",
      "給它六十秒成名時間：", "把麥克風轉向", "收集",
      "為它拍一部迷你聲音紀錄片：", "仔細聽並捕捉", "把它從寂靜中救出：",
    ],
    sounds: [
      "躲在關閉門後的聲音", "你能接近的最安靜機器",
      "沒有人故意演奏的節奏", "遠離水龍頭的水聲",
      "比你年長卻仍會發出聲音的東西", "今天最不美麗的聲音",
      "靠近時會改變的聲音", "在同一房間吵架的三件物品",
      "耳朵能找到的最遠聲音", "假裝自己是樂器的普通物品",
    ],
    endings: [
      "加上一個效果，看看它會不會變得更有禮貌。",
      "狠心剪掉多餘部分；這個聲音大概會原諒你。",
      "最多加入三個效果，替它穿上一套可疑的小服裝。",
      "倒轉播放，看看它是不是藏了祕密。",
      "選三個足以讓考古學家困惑的表情符號。",
      "取一個配得上超迷你實驗專輯的名字。",
      "留下十秒鐘，像是一部從未拍攝電影的開場。",
      "把效果混得奇怪一點，但保留一小塊可辨認的現實。",
      "私下收藏，或讓它所在的城市在 FIELD World 聽見。",
      "如果熱水壺加入錄音，它就自動成為製作人。",
    ],
  },
};

export function dailyMission(locale, rawIndex) {
  const copy = missions[locale] ?? missions.en;
  const index = ((Number(rawIndex) || 0) % DAILY_MISSION_COUNT + DAILY_MISSION_COUNT) % DAILY_MISSION_COUNT;
  const start = copy.starts[Math.floor(index / 10)];
  const sound = copy.sounds[index % 10];
  const ending = copy.endings[(index * 7 + 3) % 10];
  return `${start} ${sound}. ${ending}`;
}

// A playful archive number, not a claim about the corpus size. Multiplication by
// 791 permutes the visible 000–999 range instead of counting upward.
export function dailyMissionNumber(rawIndex) {
  const index = ((Number(rawIndex) || 0) % 1000 + 1000) % 1000;
  return String((index * 791 + 137) % 1000).padStart(3, "0");
}
