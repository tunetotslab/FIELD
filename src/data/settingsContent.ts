import type { Locale } from "../i18n";

export interface ArticleSection {
  heading?: string;
  paragraphs: string[];
}
export interface SettingsArticle {
  title: string;
  intro?: string;
  sections: ArticleSection[];
}

const ru = {
  privacy: {
    title: "Ваши звуки - ваш выбор",
    sections: [
      {
        paragraphs: [
          "FIELD создан, чтобы замечать интересные звуки, экспериментировать и делиться находками. Скрип двери может стать басом, а дождь по подоконнику - целым треком. Следить за вами для этого совершенно не нужно.",
          "Личные записи сохраняются в библиотеке на вашем устройстве. Они не становятся общедоступными просто потому, что вы нажали «Сохранить».",
        ],
      },
      {
        heading: "Публикация",
        paragraphs: [
          "Общий сервис FIELD WORLD и Tune Tots Group пока не подключён. Поэтому текущая сборка не отправляет запись в общее сообщество и не показывает локальное сохранение как публикацию.",
          "Когда публикация будет подключена, она должна происходить только после отдельного явного подтверждения с понятным списком отправляемых данных.",
        ],
      },
      {
        heading: "Место без слежки",
        paragraphs: [
          "На карте используется выбранный вручную город и страна. FIELD не запрашивает GPS для выбора города и не сохраняет точное положение устройства.",
          "Указывать местоположение необязательно. Можно записывать, редактировать и сохранять звуки только для себя.",
        ],
      },
      {
        heading: "Что хранится",
        paragraphs: [
          "На устройстве сохраняются аудиофайл и данные карточки: название, emoji, оформление, эффект и выбранное место. Удаление записи из Library удаляет эту локальную копию.",
          "В коде приложения не подключены аналитика, рекламное профилирование или продажа данных. Поиск города обращается к OpenStreetMap Nominatim и передаёт текст запроса, код выбранной страны и обычные технические данные сетевого запроса.",
          "FIELD не включает микрофон тайком. Вы решаете, что записать, что сохранить и чем поделиться.",
        ],
      },
    ],
  },
  microphone: {
    title: "Микрофон: впускаем звуки",
    sections: [
      {
        paragraphs: [
          "Обычно FIELD использует встроенный микрофон телефона. Гарнитура или внешний микрофон могут быть выбраны устройством как источник звука.",
          "Чтобы записать сэмпл, разрешите FIELD доступ к микрофону. Это нужно, чтобы поймать голос, дождь, шуршание пакета или очень убедительное соло чайника.",
        ],
      },
      {
        paragraphs: [
          "FIELD не включает микрофон тайком. Запись запускаете вы, и во время неё на экране видно живой сигнал.",
          "После остановки записи микрофон освобождается. Проверка доступа ниже тоже не создаёт и не сохраняет запись.",
        ],
      },
      {
        heading: "Не получилось?",
        paragraphs: [
          "Проверьте доступ к микрофону в настройках браузера или приложения, через которое открыт FIELD, и попробуйте ещё раз.",
        ],
      },
    ],
  },
  help: {
    title: "Нужна помощь? Мы на связи",
    intro:
      "Кнопка задумалась? Звук решил поиграть в прятки? Или появилась идея, как сделать FIELD лучше? Напиши нам - разберёмся.",
    sections: [
      {
        heading: "Как сохранить первую находку",
        paragraphs: [
          "1. Нажми Record и разреши микрофон.\n2. Запиши и останови звук.\n3. Прослушай, обрежь лишнее и попробуй эффекты.\n4. Выбери три emoji, название и оформление.\n5. Сохрани звук в Library.\n6. Публикация станет доступна отдельно, когда будет подключён общий сервис.",
        ],
      },
      {
        heading: "Почему не записывается звук?",
        paragraphs: [
          "Проверь разрешение на микрофон в браузере или приложении, через которое открыт FIELD.",
        ],
      },
      {
        heading: "Почему ничего не слышно?",
        paragraphs: [
          "Проверь громкость, подключённые наушники и запусти воспроизведение ещё раз.",
        ],
      },
      {
        heading: "Обязательно ли отмечаться на карте?",
        paragraphs: ["Нет. Можно сохранять записи только в своей библиотеке."],
      },
      {
        heading: "Как сообщить об ошибке?",
        paragraphs: [
          "Напиши, на каком устройстве открыт FIELD, что ты нажал и что произошло. Если можешь, приложи скриншот. Сам звук присылай только по своему желанию.",
        ],
      },
    ],
  },
  about: {
    title: "О FIELD",
    sections: [
      {
        heading: "Что такое FIELD",
        paragraphs: [
          "FIELD - карманная лаборатория звука от Tune Tots Lab и Николы Чена, музыканта, композитора, саунд-дизайнера, основателя и преподавателя лаборатории.",
          "Здесь можно записать интересный звук, обрезать его, поэкспериментировать с эффектами и собрать личную коллекцию. Даже если главный герой записи - стул.",
        ],
      },
      {
        heading: "Field recordings",
        paragraphs: [
          "Field recordings - полевые записи звуков окружающего мира. Полем может стать лес, улица, вокзал, кухня или карман с подозрительно музыкальной связкой ключей.",
          "Пение птиц, городской гул, шаги, вода и случайный ритм могут стать сэмплами, саунд-дизайном или звуковыми воспоминаниями.",
        ],
      },
      {
        heading: "Запись и редактирование",
        paragraphs: [
          "Поймай звук через микрофон и следи за живой визуализацией. Затем оставь самое интересное: Trim ограничивает начало и конец фрагмента, а эффекты применяются после записи.",
        ],
      },
      {
        heading: "Эффекты",
        paragraphs: [
          "Original оставляет исходное звучание. Echo создаёт повторения, Resonator добавляет тональные резонансы, Tape Stop замедляет звук с падением высоты, Chorus создаёт несколько слегка различающихся голосов, Flanger - движущийся реактивный оттенок.",
          "Lo-Fi делает звук шероховатым, Glitch превращает его в прерывистые жесты, Reverse разворачивает назад, Pitch меняет высоту, Space добавляет пространство, а Destroy - сильное искажение. Эффекты здесь являются постобработкой, а не записью уже обработанного сигнала.",
        ],
      },
      {
        heading: "Карточка, Library и Daily",
        paragraphs: [
          "Выбери три emoji, название и стиль. Library хранит записи на устройстве: их можно слушать, переименовывать, отмечать, экспортировать и удалять.",
          "Daily - повод прислушаться и выполнить звуковое задание по-своему. Экзамена по шуршанию здесь нет.",
        ],
      },
      {
        heading: "FIELD WORLD и Tune Tots Group",
        paragraphs: [
          "FIELD WORLD задуман как карта звуковых находок по городам, а Tune Tots Group - как пространство учебного сообщества. Общий сервис публикации пока не подключён, поэтому текущая сборка честно не выдаёт локальные записи за общедоступные.",
        ],
      },
      {
        heading: "Tune Tots Lab",
        paragraphs: [
          "Tune Tots Lab - детская экспериментальная музыкальная лаборатория. Наш принцип - Play · Improvise · Create. Мы исследуем ритм, мелодию и звук через игру, импровизацию, технологии и собственное творчество.",
          "FIELD продолжает эту идею за пределами занятия: услышал, записал, принёс в лабораторию - и у будущей композиции уже есть первый герой.",
        ],
      },
      {
        heading: "Никола Чен",
        paragraphs: [
          "Никола Чен / Nikola Chen - музыкант, композитор, саунд-дизайнер, мультиинструменталист, основатель и преподаватель Tune Tots Lab.",
          "FIELD вырос из практики слушать внимательнее, экспериментировать свободнее и замечать музыку там, где её обычно проходят мимо.",
        ],
      },
      {
        heading: "Бесплатно",
        paragraphs: [
          "FIELD - бесплатное приложение для обмена классными звуками, музыкальных экспериментов и знакомства людей, которым интересно слушать мир.",
        ],
      },
    ],
  },
} satisfies Record<string, SettingsArticle>;

const en: typeof ru = {
  privacy: {
    title: "Your sounds, your choice",
    sections: [
      {
        paragraphs: [
          "FIELD is made for noticing sounds, experimenting, and sharing discoveries - not for quietly tracking you.",
          "Private recordings stay in the library on this device. Tapping Save does not make them public.",
        ],
      },
      {
        heading: "Publishing",
        paragraphs: [
          "The shared FIELD WORLD and Tune Tots Group service is not connected yet. This build does not upload recordings to a community or pretend a local save was published.",
          "Future publishing must require a separate, clear confirmation of exactly what will be shared.",
        ],
      },
      {
        heading: "Location without tracking",
        paragraphs: [
          "Map locations use a city and country you choose manually. FIELD does not request GPS for city search or store your device's exact position.",
          "Location is optional. You can record, edit, and save only for yourself.",
        ],
      },
      {
        heading: "What is stored",
        paragraphs: [
          "Audio and card details - title, emoji, style, effect, and an optional selected place - are stored on this device. Deleting a Library item removes that local copy.",
          "No analytics or advertising trackers are connected. City search contacts OpenStreetMap Nominatim with the search text and country code, plus normal network request metadata.",
          "FIELD uses the microphone only for actions you start.",
        ],
      },
    ],
  },
  microphone: {
    title: "Microphone: let the sounds in",
    sections: [
      {
        paragraphs: [
          "FIELD normally uses your device microphone. A headset or external microphone may be selected by the device.",
          "Allow microphone access to catch a voice, rain, a rustling bag, or a surprisingly convincing kettle solo.",
        ],
      },
      {
        paragraphs: [
          "FIELD does not turn the microphone on secretly. You start recording and see a live signal while it runs.",
          "The microphone is released after recording. The access check below does not create or save a recording.",
        ],
      },
      {
        heading: "No luck?",
        paragraphs: [
          "Check microphone permission in the browser or app that opened FIELD, then try again.",
        ],
      },
    ],
  },
  help: {
    title: "Need help? We're here",
    intro:
      "A button is thinking too hard? A sound is hiding? Send us a note and we'll investigate.",
    sections: [
      {
        heading: "Save your first find",
        paragraphs: [
          "1. Tap Record and allow the microphone.\n2. Record and stop.\n3. Listen, trim, and try effects.\n4. Pick three emoji, a title, and a style.\n5. Save to Library.\n6. Community publishing will be a separate action when its service is connected.",
        ],
      },
      {
        heading: "Why won't it record?",
        paragraphs: [
          "Check microphone permission in your browser or host app.",
        ],
      },
      {
        heading: "Why can't I hear anything?",
        paragraphs: ["Check volume and headphones, then try playback again."],
      },
      {
        heading: "Must I appear on the map?",
        paragraphs: ["No. You can keep everything in your private Library."],
      },
      {
        heading: "Report a bug",
        paragraphs: [
          "Tell us the device, what you tapped, and what happened. A screenshot helps. Send the sound itself only if you want to.",
        ],
      },
    ],
  },
  about: {
    title: "About FIELD",
    sections: [
      {
        heading: "What is FIELD?",
        paragraphs: [
          "FIELD is a pocket sound laboratory by Tune Tots Lab and Nikola Chen - musician, composer, sound designer, founder, and teacher.",
          "Record a curious sound, trim it, experiment with effects, and build a collection. Even when the star is a chair.",
        ],
      },
      {
        heading: "Field recordings",
        paragraphs: [
          "Field recordings capture the world outside a conventional studio. A forest, street, station, kitchen, or suspiciously musical keyring can all be your field.",
        ],
      },
      {
        heading: "Record and edit",
        paragraphs: [
          "Watch the real microphone signal, keep the best part with Trim, then apply effects after recording.",
        ],
      },
      {
        heading: "Effects",
        paragraphs: [
          "Original is dry. Echo repeats, Resonator adds tuned colour, Tape Stop slows and drops pitch, Chorus multiplies voices, and Flanger sweeps. Lo-Fi roughens, Glitch chops, Reverse flips, Pitch shifts, Space expands, and Destroy distorts hard.",
        ],
      },
      {
        heading: "Cards, Library, and Daily",
        paragraphs: [
          "Choose three emoji, a title, and style. Library keeps local sounds for playback, renaming, favourites, export, and deletion. Daily gives you a small listening mission - no rustling exam required.",
        ],
      },
      {
        heading: "FIELD WORLD and Tune Tots Group",
        paragraphs: [
          "These are designed as a city-level sound map and a learning community. Shared publishing is not connected yet, so this build does not present local items as public ones.",
        ],
      },
      {
        heading: "Tune Tots Lab",
        paragraphs: [
          "Tune Tots Lab is an experimental music lab for children. Play · Improvise · Create: rhythm, melody, sound, technology, and original ideas.",
        ],
      },
      {
        heading: "Nikola Chen",
        paragraphs: [
          "Nikola Chen is a musician, composer, sound designer, multi-instrumentalist, and founder and teacher of Tune Tots Lab. FIELD grew from listening closer and finding music in overlooked places.",
        ],
      },
      {
        heading: "Free",
        paragraphs: [
          "FIELD is free to use for sound experiments and people curious about how the world sounds.",
        ],
      },
    ],
  },
};

const hy: typeof ru = {
  privacy: {
    title: "Ձեր ձայները՝ ձեր ընտրությունը",
    sections: [
      {
        paragraphs: [
          "FIELD-ը ստեղծվել է ձայներ նկատելու, փորձարկելու և բացահայտումներով կիսվելու համար, ոչ թե ձեզ գաղտնի հետևելու։",
          "Անձնական ձայնագրությունները պահվում են այս սարքի ձայնադարանում։ «Պահպանել»-ը դրանք հանրային չի դարձնում։",
        ],
      },
      {
        heading: "Հրապարակում",
        paragraphs: [
          "FIELD WORLD-ի և Tune Tots Group-ի ընդհանուր ծառայությունը դեռ միացված չէ։ Այս տարբերակը ձայները համայնք չի ուղարկում և տեղական պահպանումը հրապարակում չի անվանում։",
        ],
      },
      {
        heading: "Տեղադրություն առանց հետևելու",
        paragraphs: [
          "Քաղաքն ու երկիրը ընտրում եք ձեռքով։ FIELD-ը քաղաքի որոնման համար GPS չի խնդրում և սարքի ճշգրիտ դիրքը չի պահում։",
          "Տեղադրությունը պարտադիր չէ։",
        ],
      },
      {
        heading: "Ինչ է պահվում",
        paragraphs: [
          "Սարքում պահվում են ձայնը և քարտի տվյալները։ Library-ից ջնջելը հեռացնում է տեղական պատճենը։",
          "Վերլուծական կամ գովազդային հետևման ծառայություններ միացված չեն։ Քաղաքի որոնումը OpenStreetMap Nominatim-ին փոխանցում է որոնման տեքստն ու երկրի կոդը։",
          "Միկրոֆոնն օգտագործվում է միայն ձեր սկսած գործողությունների համար։",
        ],
      },
    ],
  },
  microphone: {
    title: "Միկրոֆոն՝ ներս թողնենք ձայները",
    sections: [
      {
        paragraphs: [
          "FIELD-ը սովորաբար օգտագործում է սարքի ներկառուցված միկրոֆոնը։ Արտաքին միկրոֆոնը կարող է ընտրվել սարքի կողմից։",
          "Թույլատրեք մուտքը՝ ձայն, անձրև կամ թեյնիկի համոզիչ սոլոն որսալու համար։",
        ],
      },
      {
        paragraphs: [
          "FIELD-ը միկրոֆոնը գաղտնի չի միացնում։ Դուք եք սկսում ձայնագրումը և տեսնում կենդանի ազդանշանը։",
          "Ստուգումը ձայնագրություն չի ստեղծում և անմիջապես ազատում է միկրոֆոնը։",
        ],
      },
      {
        heading: "Չստացվե՞ց",
        paragraphs: [
          "Ստուգեք միկրոֆոնի թույլտվությունը դիտարկիչի կամ FIELD-ը բացած հավելվածի կարգավորումներում։",
        ],
      },
    ],
  },
  help: {
    title: "Օգնությո՞ւն է պետք։ Մենք այստեղ ենք",
    intro: "Կոճակը մտածմունքի մե՞ջ է, իսկ ձայնը թաքնվե՞լ է։ Գրեք մեզ։",
    sections: [
      {
        heading: "Առաջին ձայնը",
        paragraphs: [
          "1. Սեղմեք Record և թույլատրեք միկրոֆոնը։\n2. Ձայնագրեք ու կանգնեցրեք։\n3. Լսեք, կտրեք և փորձեք էֆեկտները։\n4. Ընտրեք երեք emoji, անուն ու ոճ։\n5. Պահպանեք Library-ում։",
        ],
      },
      {
        heading: "Ինչո՞ւ չի ձայնագրվում",
        paragraphs: ["Ստուգեք միկրոֆոնի թույլտվությունը։"],
      },
      {
        heading: "Ինչո՞ւ ոչինչ չի լսվում",
        paragraphs: ["Ստուգեք ձայնի բարձրությունն ու ականջակալները։"],
      },
      {
        heading: "Քարտեզը պարտադի՞ր է",
        paragraphs: ["Ոչ։ Կարող եք ամեն ինչ պահել անձնական Library-ում։"],
      },
      {
        heading: "Սխալի մասին",
        paragraphs: [
          "Նշեք սարքը, ձեր քայլերը և արդյունքը։ Սքրինշոթը կօգնի, իսկ ձայնը ուղարկեք միայն ցանկության դեպքում։",
        ],
      },
    ],
  },
  about: {
    title: "FIELD-ի մասին",
    sections: [
      {
        heading: "Ի՞նչ է FIELD-ը",
        paragraphs: [
          "FIELD-ը Tune Tots Lab-ի և երաժիշտ, կոմպոզիտոր ու ձայնային դիզայներ Nikola Chen-ի գրպանի ձայնային լաբորատորիան է։",
          "Ձայնագրեք, կտրեք, փորձարկեք էֆեկտները և ստեղծեք հավաքածու։",
        ],
      },
      {
        heading: "Field recordings",
        paragraphs: [
          "Դաշտային ձայնագրությունները շրջակա աշխարհի ձայներն են՝ անտառից, փողոցից, խոհանոցից կամ երաժշտական բանալիներից։",
        ],
      },
      {
        heading: "Գործիքներ",
        paragraphs: [
          "Կենդանի ազդանշանը ցույց է տալիս միկրոֆոնը, Trim-ը պահում է ընտրված հատվածը, իսկ էֆեկտները կիրառվում են ձայնագրությունից հետո։",
        ],
      },
      {
        heading: "Էֆեկտներ",
        paragraphs: [
          "Original, Echo, Resonator, Tape Stop, Chorus, Flanger, Lo-Fi, Glitch, Reverse, Pitch, Space և Destroy էֆեկտները պահպանում, կրկնում, գունավորում, դանդաղեցնում, բազմապատկում, շարժում, կոպտացնում, կտրատում, շրջում, փոխում, տարածում կամ ուժեղ աղավաղում են ձայնը։",
        ],
      },
      {
        heading: "Ձայնադարան և օրվա առաջադրանք",
        paragraphs: [
          "Երեք էմոջին, անունն ու ոճը ձևավորում են քարտը։ Ձայնադարանում կարելի է լսել, վերանվանել, արտահանել և ջնջել։ Օրվա առաջադրանքը փոքր լսողական արկած է։",
        ],
      },
      {
        heading: "FIELD WORLD և Tune Tots Group",
        paragraphs: [
          "Դրանք նախատեսված են որպես քաղաքների ձայնային քարտեզ և ուսումնական համայնք, բայց ընդհանուր հրապարակման ծառայությունը դեռ միացված չէ։",
        ],
      },
      {
        heading: "Tune Tots Lab",
        paragraphs: [
          "Փորձարարական երաժշտական լաբորատորիա երեխաների համար։ Play · Improvise · Create։",
        ],
      },
      {
        heading: "Nikola Chen",
        paragraphs: [
          "Երաժիշտ, կոմպոզիտոր, ձայնային դիզայներ, մուլտիինստրումենտալիստ և Tune Tots Lab-ի հիմնադիր-դասավանդող։",
        ],
      },
      {
        heading: "Անվճար",
        paragraphs: [
          "FIELD-ն անվճար է ձայնային փորձերի և աշխարհի հնչողությամբ հետաքրքրվողների համար։",
        ],
      },
    ],
  },
};

const zh: typeof ru = {
  privacy: {
    title: "你的聲音，由你決定",
    sections: [
      {
        paragraphs: [
          "FIELD 用來發現聲音、實驗與分享，不會偷偷追蹤你。",
          "私人錄音保存在這部裝置的聲音庫。按下「儲存」不會讓它公開。",
        ],
      },
      {
        heading: "發佈",
        paragraphs: [
          "FIELD WORLD 與 Tune Tots Group 的共享服務尚未連線。本版本不會上傳錄音，也不會把本機儲存假裝成公開發佈。",
        ],
      },
      {
        heading: "不追蹤的位置",
        paragraphs: [
          "城市與國家由你手動選擇。FIELD 不會為城市搜尋要求 GPS，也不儲存裝置的精確位置。",
          "位置完全選填。",
        ],
      },
      {
        heading: "儲存哪些資料",
        paragraphs: [
          "音訊與卡片資料會保存在此裝置。從 Library 刪除會移除本機副本。",
          "程式沒有連接分析或廣告追蹤。城市搜尋會把搜尋文字與國家代碼傳給 OpenStreetMap Nominatim。",
          "麥克風只會用於你主動啟動的功能。",
        ],
      },
    ],
  },
  microphone: {
    title: "麥克風：讓聲音進來",
    sections: [
      {
        paragraphs: [
          "FIELD 通常使用裝置內建麥克風；裝置也可能選擇耳機或外接麥克風。",
          "允許麥克風，就能捕捉人聲、雨聲、塑膠袋，或很有說服力的熱水壺獨奏。",
        ],
      },
      {
        paragraphs: [
          "FIELD 不會偷偷開啟麥克風。錄音由你開始，畫面會顯示即時訊號。",
          "錄音與權限檢查完成後都會釋放麥克風；檢查不會建立或儲存錄音。",
        ],
      },
      {
        heading: "還是不行？",
        paragraphs: ["請在瀏覽器或開啟 FIELD 的應用程式設定中檢查麥克風權限。"],
      },
    ],
  },
  help: {
    title: "需要幫忙？我們在這裡",
    intro: "按鈕想太久？聲音躲起來了？寫信給我們，一起找原因。",
    sections: [
      {
        heading: "儲存第一個聲音",
        paragraphs: [
          "1. 點 Record 並允許麥克風。\n2. 錄音並停止。\n3. 聆聽、裁切並試用效果。\n4. 選三個 emoji、標題與風格。\n5. 儲存到 Library。",
        ],
      },
      {
        heading: "為什麼無法錄音？",
        paragraphs: ["檢查瀏覽器或主應用程式的麥克風權限。"],
      },
      {
        heading: "為什麼沒有聲音？",
        paragraphs: ["檢查音量與耳機，再試一次。"],
      },
      {
        heading: "一定要出現在地圖嗎？",
        paragraphs: ["不用。你可以只保存在私人 Library。"],
      },
      {
        heading: "回報錯誤",
        paragraphs: [
          "告訴我們裝置、操作步驟和結果。截圖會有幫助；只有你願意時才傳送聲音。",
        ],
      },
    ],
  },
  about: {
    title: "關於 FIELD",
    sections: [
      {
        heading: "FIELD 是什麼？",
        paragraphs: [
          "FIELD 是 Tune Tots Lab 與音樂家、作曲家、聲音設計師 Nikola Chen 打造的口袋聲音實驗室。",
          "錄下有趣聲音、裁切、試效果並建立收藏；即使主角只是一張椅子。",
        ],
      },
      {
        heading: "Field recordings",
        paragraphs: [
          "田野錄音捕捉傳統錄音室以外的世界：森林、街道、車站、廚房，或很會唱歌的鑰匙圈。",
        ],
      },
      {
        heading: "錄音與編輯",
        paragraphs: [
          "觀看真實麥克風訊號，用 Trim 留下精彩片段，再於錄音後加入效果。",
        ],
      },
      {
        heading: "效果",
        paragraphs: [
          "Original 保留原音；Echo 重複、Resonator 增加共鳴、Tape Stop 減速降音高、Chorus 疊出多個聲部、Flanger 掃動。Lo-Fi 粗化、Glitch 切碎、Reverse 倒放、Pitch 變調、Space 增加空間、Destroy 強烈失真。",
        ],
      },
      {
        heading: "卡片、聲音庫與每日挑戰",
        paragraphs: [
          "三個表情符號、標題與風格組成卡片。聲音庫可播放、改名、收藏、匯出與刪除。每日挑戰是一個小小的聆聽任務。",
        ],
      },
      {
        heading: "FIELD WORLD 與 Tune Tots Group",
        paragraphs: [
          "它們規劃為城市聲音地圖與學習社群，但共享發佈服務尚未連線。",
        ],
      },
      {
        heading: "Tune Tots Lab",
        paragraphs: ["給孩子的實驗音樂實驗室：Play · Improvise · Create。"],
      },
      {
        heading: "Nikola Chen",
        paragraphs: [
          "音樂家、作曲家、聲音設計師、多樂器演奏者，以及 Tune Tots Lab 創辦人與教師。",
        ],
      },
      {
        heading: "免費",
        paragraphs: ["FIELD 免費提供給喜歡聲音實驗與聆聽世界的人。"],
      },
    ],
  },
};

const content: Record<Locale, typeof ru> = { ru, en, hy, "zh-TW": zh };
export const settingsContent = (locale: Locale) => content[locale];
