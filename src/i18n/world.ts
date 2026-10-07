export const worldEn = {
  telegramFileNotice:
    "In Telegram, Export/Share sends the WAV to your private FIELD bot chat. It is not published to World.",
  fileDelivered:
    "The WAV is in your private FIELD bot chat. Save or forward the file there.",
  fileBotChat: "Open FIELD bot chat",
  fileTransferUnknown:
    "Delivery is uncertain. Check the private FIELD bot chat before retrying.",
  fileTransferDenied:
    "Allow messages from FIELD: open the bot chat and press Start, then retry.",
  fileTransferFailed:
    "Could not transfer the WAV. Keep this screen open and retry.",
  transferringFile: "Transferring WAV…",
  publicationStorageFailed:
    "Could not update the local Library. Keep this screen open and export the sound before closing it.",
  shareWav: "SHARE WAV",
  shareFailed: "Could not open file sharing. Your audio stays on this device.",
  worldTelegramOnly:
    "Open FIELD from its Telegram bot to view World. This browser has no Telegram session.",
  emailComposeChoice:
    "Choose Gmail in the browser or your default mail app. If no mail app is configured, copy the address above.",
  defaultMail: "Default mail app",
  publicationAudioFailed:
    "Cannot process this saved audio. Keep it; try downloading it from Library.",
  publicationNetworkFailed:
    "Could not reach FIELD. Check your connection and retry. Your recording remains local.",
  publicationTooLarge:
    "The upload exceeds the size limit. Your recording remains local.",
  publicationCityFailed: "Choose the city again from suggestions and retry.",
  publicationLocationRestricted:
    "World publishing is currently unavailable for this city. You can keep the sound in Library or send it to your Group.",
  worldRestricted:
    "World publishing is currently unavailable for this city. You can keep the sound in Library or send it to your Group.",
  publicationMetadataFailed: "Check the title, three emoji and audio format.",
  publicationAccessFailed:
    "This account does not have access to the destination.",
  publicationLimitFailed: "Daily upload limit reached. Try tomorrow.",
  publicationServiceFailed:
    "FIELD could not accept the publication. Your recording remains local; retry later.",
  copyEmail: "Copy email",
  emailCopied: "Email copied",
  emailCopyFailed: "Select the email address and copy it.",
  worldSaveFile: "Save file · if downloading did not start",
  worldDownload: "Download WAV",
  worldLike: "Like",
  worldActionFailed: "Could not complete this action. Please try again.",
  publicationLengthNotice:
    "The shared copy is limited to 60 seconds. The full recording stays on this device.",
  fxAdd: "Add effect · up to 3",
  fxBypass: "Bypass",
  fxMove: "Move earlier",
  fxRemove: "Remove effect",
  worldConfirm: "Publish to FIELD World?",
  worldConsent:
    "Anyone using FIELD can listen and download. Public audio is also sent to @Fieldapp; downloaded copies cannot be recalled. Only your city is shown, never precise GPS. Share only audio you have permission to publish.",
  publish: "Publish",
  preparing: "Preparing audio…",
  uploading: "Uploading to World…",
  offlinePending:
    "Saved here. Waiting for connection; upload will retry when FIELD is open.",
  retry: "Retry",
  localState: "On this device",
  pendingState: "Waiting to upload",
  failedState: "Upload failed",
  publishedState: "Published to World",
  groupPublishedState: "Published to group",
  seeMap: "See on Map",
  done: "Done",
  removeWorld: "Remove from World",
  removeWorldConfirm:
    "Remove this public recording? Your local audio stays in Library.",
  editSaved: "Edit recording",
  publishWorld: "Add to World",
  publishGroup: "Add to Tune Tots Group",
  loadMore: "More sounds",
  loading: "Loading…",
  audioFailed: "Could not play this sound. Try again.",
  report: "Report",
  reportTitle: "What is wrong with this recording?",
  reportPrivacy: "Privacy / personal information",
  reportAbuse: "Harmful or abusive content",
  reportCopyright: "Copyright",
  reportOther: "Other",
  reportSent: "Report sent. The FIELD owner will review it.",
  reportFailed: "Could not send the report. Try again.",
  searchCityButton: "Find city",
  sessionExpired:
    "Close FIELD and reopen it from the Telegram bot to refresh your session.",
  worldLoading: "Listening for cities…",
  worldRefresh: "Refresh World",
  noCitySounds: "No public sounds here yet.",
  legacyEdit:
    "This older recording has no saved original. Editing starts from its saved audio.",
  storageFailed: "Could not save or process audio. Your original remains here.",
  groupUpload: "Uploading to group…",
  editVersion:
    "Save edits as a new version; existing publications remain unchanged.",
  privateDelete:
    "Delete this local recording? Public copies stay online until you remove them from World.",
  groupRetryWarning:
    "Retry group upload? If the previous request finished before the connection broke, a second copy may be sent.",
};
type Copy = Record<keyof typeof worldEn, string>;
export const worldRu: Copy = {
  telegramFileNotice:
    "В Telegram Export/Share передаёт WAV в твой личный чат с FIELD-ботом. Это не публикация в World.",
  fileDelivered:
    "WAV уже в твоём личном чате с FIELD-ботом. Там его можно сохранить или переслать.",
  fileBotChat: "Открыть чат с FIELD-ботом",
  fileTransferUnknown:
    "Статус доставки неизвестен. Проверь личный чат с FIELD-ботом перед повтором.",
  fileTransferDenied:
    "Разреши сообщения FIELD: открой чат с ботом, нажми Start и повтори.",
  fileTransferFailed:
    "Не удалось передать WAV. Оставь экран открытым и повтори.",
  transferringFile: "Передаём WAV…",
  publicationStorageFailed:
    "Не удалось обновить локальную Library. Оставь этот экран открытым и экспортируй звук перед закрытием.",
  shareWav: "ПОДЕЛИТЬСЯ WAV",
  shareFailed:
    "Не удалось открыть отправку файла. Аудио остаётся на устройстве.",
  worldTelegramOnly:
    "Открой FIELD из его Telegram-бота, чтобы увидеть World. В этом браузере нет сессии Telegram.",
  emailComposeChoice:
    "Выбери Gmail в браузере или свою почтовую программу. Если она не настроена, скопируй адрес выше.",
  defaultMail: "Почтовая программа",
  publicationAudioFailed:
    "Не удалось обработать этот звук. Сохрани его; попробуй скачать из Library.",
  publicationNetworkFailed:
    "Не удалось связаться с FIELD. Проверь подключение и повтори. Запись остаётся на устройстве.",
  publicationTooLarge:
    "Размер загрузки превышает лимит. Запись остаётся на устройстве.",
  publicationCityFailed: "Выбери город заново из подсказок и повтори.",
  publicationLocationRestricted:
    "Публикация в World для этого города пока недоступна. Можно сохранить звук в Library или отправить в свою Group.",
  worldRestricted:
    "Публикация в World для этого города пока недоступна. Можно сохранить звук в Library или отправить в свою Group.",
  publicationMetadataFailed: "Проверь название, три emoji и формат аудио.",
  publicationAccessFailed:
    "У этого аккаунта нет доступа к выбранному месту публикации.",
  publicationLimitFailed:
    "Дневной лимит публикаций достигнут. Попробуй завтра.",
  publicationServiceFailed:
    "FIELD не смог принять публикацию. Запись остаётся на устройстве; повтори позже.",
  copyEmail: "Скопировать почту",
  emailCopied: "Адрес скопирован",
  emailCopyFailed: "Выдели адрес почты и скопируй его.",
  worldSaveFile: "Сохранить файл · если загрузка не началась",
  worldDownload: "Скачать WAV",
  worldLike: "Нравится",
  worldActionFailed: "Не удалось выполнить действие. Попробуйте снова.",
  publicationLengthNotice:
    "Публичная копия — до 60 секунд. Полная запись остаётся на этом устройстве.",
  fxAdd: "Добавить эффект · до 3",
  fxBypass: "Обход",
  fxMove: "Переместить выше",
  fxRemove: "Убрать эффект",
  worldConfirm: "Опубликовать в FIELD World?",
  worldConsent:
    "Запись смогут слушать и скачивать все пользователи FIELD. Аудио также попадёт в @Fieldapp; скачанные копии вернуть нельзя. Видно только город, не точное местоположение. Публикуйте только то, чем вправе делиться.",
  publish: "Опубликовать",
  preparing: "Подготавливаем аудио…",
  uploading: "Загружаем в World…",
  offlinePending:
    "Сохранено здесь. Ждём связь; загрузка повторится, пока FIELD открыт.",
  retry: "Повторить",
  localState: "На этом устройстве",
  pendingState: "Ожидает загрузки",
  failedState: "Загрузка не удалась",
  publishedState: "Опубликовано в World",
  groupPublishedState: "Опубликовано в группе",
  seeMap: "Показать на карте",
  done: "Готово",
  removeWorld: "Убрать из World",
  removeWorldConfirm:
    "Убрать публичную запись? Локальное аудио останется в Library.",
  editSaved: "Редактировать запись",
  publishWorld: "Добавить в World",
  publishGroup: "Добавить в Tune Tots Group",
  loadMore: "Ещё звуки",
  loading: "Загрузка…",
  audioFailed: "Не удалось воспроизвести звук. Попробуйте снова.",
  report: "Пожаловаться",
  reportTitle: "Что не так с этой записью?",
  reportPrivacy: "Приватность / личные данные",
  reportAbuse: "Оскорбительный или опасный контент",
  reportCopyright: "Авторские права",
  reportOther: "Другое",
  reportSent: "Жалоба отправлена. Владелец FIELD прослушает запись и решит.",
  reportFailed: "Не удалось отправить жалобу. Попробуйте снова.",
  searchCityButton: "Найти город",
  sessionExpired:
    "Закрой FIELD и открой заново из Telegram-бота, чтобы обновить сессию.",
  worldLoading: "Ищем города со звуками…",
  worldRefresh: "Обновить World",
  noCitySounds: "Здесь пока нет публичных звуков.",
  legacyEdit:
    "У этой старой записи не сохранён оригинал. Редактирование начнётся с сохранённого аудио.",
  storageFailed:
    "Не удалось сохранить или обработать аудио. Оригинал остаётся здесь.",
  groupUpload: "Загружаем в группу…",
  editVersion:
    "Изменения сохранятся новой версией; прежние публикации останутся без изменений.",
  privateDelete:
    "Удалить локальную запись? Публичная копия останется, пока вы не уберёте её из World.",
  groupRetryWarning:
    "Повторить загрузку в группу? Если предыдущий запрос успел завершиться до обрыва связи, может отправиться вторая копия.",
};
export const worldHy: Copy = {
  telegramFileNotice:
    "Telegram-ում Export/Share-ը WAV-ը փոխանցում է FIELD բոտի հետ քո անձնական չատին։ Սա World-ի հրապարակում չէ։",
  fileDelivered:
    "WAV-ը քո անձնական FIELD բոտի չատում է։ Այնտեղ կարող ես պահել կամ փոխանցել ֆայլը։",
  fileBotChat: "Բացել FIELD բոտի չատը",
  fileTransferUnknown:
    "Առաքման կարգավիճակն անհայտ է։ Կրկնելուց առաջ ստուգիր FIELD բոտի անձնական չատը։",
  fileTransferDenied:
    "Թույլատրի՛ր FIELD-ի հաղորդագրությունները․ բացիր բոտի չատը, սեղմիր Start և կրկնիր։",
  fileTransferFailed: "WAV-ը չհաջողվեց փոխանցել։ Էջը բաց պահիր և կրկնիր։",
  transferringFile: "Փոխանցում ենք WAV-ը…",
  publicationStorageFailed:
    "Տեղական Ձայնադարանը չհաջողվեց թարմացնել։ Պահիր այս էջը բաց և արտահանիր ձայնը մինչև փակելը։",
  shareWav: "ԿԻՍՎԵԼ WAV-ՈՎ",
  shareFailed: "Ֆայլով կիսվելը չհաջողվեց։ Ձայնը մնում է սարքում։",
  worldTelegramOnly:
    "World-ը տեսնելու համար բացիր FIELD-ը իր Telegram բոտից։ Այս դիտարկիչում Telegram սեսիա չկա։",
  emailComposeChoice:
    "Ընտրիր Gmail-ը դիտարկիչում կամ քո փոստային ծրագիրը։ Եթե ծրագիրը կարգավորված չէ, պատճենիր վերևի հասցեն։",
  defaultMail: "Փոստային ծրագիր",
  publicationAudioFailed:
    "Այս ձայնը չհաջողվեց մշակել։ Պահպանիր այն, փորձիր ներբեռնել Ձայնադարանից։",
  publicationNetworkFailed:
    "FIELD-ի հետ կապ չհաստատվեց։ Ստուգիր կապը և կրկնիր․ ձայնը սարքում է։",
  publicationTooLarge:
    "Վերբեռնումը գերազանցում է չափի սահմանը։ Ձայնը սարքում է։",
  publicationCityFailed: "Կրկին ընտրիր քաղաքը հուշումներից։",
  publicationLocationRestricted:
    "Այս քաղաքի համար World հրապարակումը դեռ հասանելի չէ։ Ձայնը կարող ես պահել Library-ում կամ ուղարկել քո Group-ին։",
  worldRestricted:
    "Այս քաղաքի համար World հրապարակումը դեռ հասանելի չէ։ Ձայնը կարող ես պահել Library-ում կամ ուղարկել քո Group-ին։",
  publicationMetadataFailed: "Ստուգիր անունը, երեք էմոջին և ձայնի ձևաչափը։",
  publicationAccessFailed: "Այս հաշիվը չունի ընտրված վայրի հասանելիությունը։",
  publicationLimitFailed: "Օրվա սահմանը լրացել է։ Փորձիր վաղը։",
  publicationServiceFailed:
    "FIELD-ը չընդունեց հրապարակումը։ Ձայնը սարքում է․ կրկնիր ավելի ուշ։",
  copyEmail: "Պատճենել էլ․ փոստը",
  emailCopied: "Հասցեն պատճենված է",
  emailCopyFailed: "Ընտրիր հասցեն և պատճենիր այն։",
  worldSaveFile: "Պահպանել ֆայլը · եթե ներբեռնումը չի սկսվել",
  worldDownload: "Ներբեռնել WAV",
  worldLike: "Հավանել",
  worldActionFailed: "Չհաջողվեց կատարել գործողությունը։ Կրկին փորձեք։",
  publicationLengthNotice:
    "Հրապարակվող պատճենը մինչև 60 վայրկյան է։ Ամբողջ ձայնագրությունը մնում է այս սարքում։",
  fxAdd: "Ավելացնել էֆեկտ · մինչև 3",
  fxBypass: "Շրջանցել",
  fxMove: "Տեղափոխել վերև",
  fxRemove: "Հեռացնել էֆեկտը",
  worldConfirm: "Հրապարակե՞լ FIELD World-ում։",
  worldConsent:
    "FIELD-ի բոլոր օգտատերերը կարող են լսել և ներբեռնել։ Ձայնը նաև ուղարկվում է @Fieldapp․ ներբեռնված պատճենները հետ կանչել հնարավոր չէ։ Տեսանելի է միայն քաղաքը, ոչ ճշգրիտ GPS-ը։ Կիսվեք միայն թույլատրված ձայնով։",
  publish: "Հրապարակել",
  preparing: "Պատրաստում ենք ձայնը…",
  uploading: "Վերբեռնում ենք World…",
  offlinePending:
    "Պահված է այստեղ։ Կրկին կփորձենք կապը վերականգնելիս, երբ FIELD-ը բաց է։",
  retry: "Կրկին փորձել",
  localState: "Այս սարքում",
  pendingState: "Սպասում է վերբեռնման",
  failedState: "Վերբեռնումը չհաջողվեց",
  publishedState: "Հրապարակված է World-ում",
  groupPublishedState: "Հրապարակված է խմբում",
  seeMap: "Տեսնել քարտեզում",
  done: "Պատրաստ է",
  removeWorld: "Հեռացնել World-ից",
  removeWorldConfirm:
    "Հեռացնե՞լ հրապարակումը։ Տեղական ձայնը մնում է Library-ում։",
  editSaved: "Խմբագրել ձայնագրությունը",
  publishWorld: "Ավելացնել World-ում",
  publishGroup: "Ավելացնել Tune Tots խմբում",
  loadMore: "Այլ ձայներ",
  loading: "Բեռնվում է…",
  audioFailed: "Չհաջողվեց նվագարկել։ Կրկին փորձեք։",
  report: "Բողոքարկել",
  reportTitle: "Ի՞նչն է սխալ այս ձայնագրության մեջ։",
  reportPrivacy: "Գաղտնիություն / անձնական տվյալներ",
  reportAbuse: "Վնասակար բովանդակություն",
  reportCopyright: "Հեղինակային իրավունք",
  reportOther: "Այլ",
  reportSent: "Բողոքն ուղարկվեց։ FIELD-ի սեփականատերը կդիտարկի այն։",
  reportFailed: "Չհաջողվեց ուղարկել։ Կրկին փորձեք։",
  searchCityButton: "Գտնել քաղաքը",
  sessionExpired:
    "Փակիր FIELD-ը և կրկին բացիր Telegram բոտից՝ սեսիան թարմացնելու համար։",
  worldLoading: "Փնտրում ենք ձայն ունեցող քաղաքներ…",
  worldRefresh: "Թարմացնել World-ը",
  noCitySounds: "Այստեղ դեռ հրապարակված ձայներ չկան։",
  legacyEdit:
    "Հին ձայնագրության բնօրինակը պահպանված չէ։ Խմբագրումը սկսվում է պահպանված ձայնից։",
  storageFailed: "Չհաջողվեց պահել կամ մշակել ձայնը։ Բնօրինակը մնում է այստեղ։",
  groupUpload: "Վերբեռնում ենք խումբ…",
  editVersion:
    "Փոփոխությունները կպահվեն նոր տարբերակով՝ առանց փոխելու հրապարակումները։",
  privateDelete:
    "Ջնջե՞լ տեղական ձայնը։ Հրապարակումը կմնա մինչև այն հեռացնեք World-ից։",
  groupRetryWarning:
    "Կրկի՞ն ուղարկել խումբ։ Եթե նախորդ հարցումն ավարտվել է, կարող է երկրորդ պատճեն ուղարկվել։",
};
export const worldZh: Copy = {
  telegramFileNotice:
    "在 Telegram 中，Export/Share 會把 WAV 傳送到你與 FIELD 機器人的私人聊天，不會發佈到 World。",
  fileDelivered:
    "WAV 已在你與 FIELD 機器人的私人聊天中。請在那裡儲存或轉傳檔案。",
  fileBotChat: "開啟 FIELD 機器人聊天",
  fileTransferUnknown: "傳送狀態不明。重試前請先查看 FIELD 機器人的私人聊天。",
  fileTransferDenied: "請允許 FIELD 訊息：開啟機器人聊天、按 Start，然後重試。",
  fileTransferFailed: "無法傳送 WAV。請保持此畫面開啟並重試。",
  transferringFile: "正在傳送 WAV…",
  publicationStorageFailed:
    "無法更新裝置上的聲音庫。請保持此畫面開啟，並在關閉前匯出聲音。",
  shareWav: "分享 WAV",
  shareFailed: "無法開啟檔案分享。音訊仍保留在裝置上。",
  worldTelegramOnly:
    "請從 FIELD 的 Telegram 機器人開啟應用程式以查看 World。此瀏覽器沒有 Telegram 工作階段。",
  emailComposeChoice:
    "選擇在瀏覽器使用 Gmail 或預設郵件程式。若未設定郵件程式，請複製上方地址。",
  defaultMail: "預設郵件程式",
  publicationAudioFailed: "無法處理此音訊。請保留錄音，並嘗試從聲音庫下載。",
  publicationNetworkFailed:
    "無法連接 FIELD。請檢查網路並重試，錄音仍留在裝置。",
  publicationTooLarge: "上傳超過大小限制。錄音仍留在裝置。",
  publicationCityFailed: "請重新從建議中選擇城市。",
  publicationLocationRestricted:
    "此城市目前無法發佈到 World。你仍可將聲音保存在 Library，或傳送到自己的 Group。",
  worldRestricted:
    "此城市目前無法發佈到 World。你仍可將聲音保存在 Library，或傳送到自己的 Group。",
  publicationMetadataFailed: "請檢查標題、三個 emoji 與音訊格式。",
  publicationAccessFailed: "此帳號無權存取所選目的地。",
  publicationLimitFailed: "已達每日上傳上限，請明天再試。",
  publicationServiceFailed: "FIELD 無法接受發佈。錄音仍留在裝置，請稍後重試。",
  copyEmail: "複製電子郵件",
  emailCopied: "已複製地址",
  emailCopyFailed: "請選取地址並複製。",
  worldSaveFile: "儲存檔案 · 若下載未開始",
  worldDownload: "下載 WAV",
  worldLike: "喜歡",
  worldActionFailed: "無法完成操作，請重試。",
  publicationLengthNotice: "分享版本最多 60 秒，完整錄音仍保留在此裝置。",
  fxAdd: "加入效果 · 最多 3 個",
  fxBypass: "略過",
  fxMove: "向前移動",
  fxRemove: "移除效果",
  worldConfirm: "發佈到 FIELD World？",
  worldConsent:
    "FIELD 使用者都能收聽及下載。公開音訊也會傳送至 @Fieldapp；已下載副本無法收回。只顯示城市，不顯示精確 GPS。請只分享有權公開的錄音。",
  publish: "發佈",
  preparing: "正在準備音訊…",
  uploading: "正在上傳到 World…",
  offlinePending: "已儲存在此裝置。FIELD 開啟且恢復連線時會重試。",
  retry: "重試",
  localState: "此裝置上",
  pendingState: "等待上傳",
  failedState: "上傳失敗",
  publishedState: "已發佈到 World",
  groupPublishedState: "已發佈到群組",
  seeMap: "在地圖上查看",
  done: "完成",
  removeWorld: "從 World 移除",
  removeWorldConfirm: "移除公開錄音？本機音訊會保留在 Library。",
  editSaved: "編輯錄音",
  publishWorld: "加入 World",
  publishGroup: "加入 Tune Tots 群組",
  loadMore: "更多聲音",
  loading: "載入中…",
  audioFailed: "無法播放。請重試。",
  report: "檢舉",
  reportTitle: "這段錄音有什麼問題？",
  reportPrivacy: "隱私／個人資訊",
  reportAbuse: "有害或侮辱性內容",
  reportCopyright: "著作權",
  reportOther: "其他",
  reportSent: "已送出檢舉。FIELD 擁有者會進行審查。",
  reportFailed: "無法送出檢舉。請重試。",
  searchCityButton: "尋找城市",
  sessionExpired:
    "請關閉 FIELD，並從 Telegram 機器人重新開啟，以更新工作階段。",
  worldLoading: "正在尋找有聲音的城市…",
  worldRefresh: "重新整理 World",
  noCitySounds: "這裡尚無公開聲音。",
  legacyEdit: "這段舊錄音沒有保留原始檔，將從已儲存的音訊開始編輯。",
  storageFailed: "無法儲存或處理音訊。原始錄音仍保留在這裡。",
  groupUpload: "正在上傳到群組…",
  editVersion: "編輯將儲存為新版本，原有發佈內容不變。",
  privateDelete: "刪除本機錄音？公開版本會保留，直到你從 World 移除。",
  groupRetryWarning: "重試群組上傳？若上次請求已完成，可能會傳送第二份副本。",
};
