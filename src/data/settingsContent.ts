import type { Locale } from "../i18n";
export interface ArticleSection { heading?: string; paragraphs: string[]; }
export interface SettingsArticle { title: string; intro?: string; sections: ArticleSection[]; }
const content: Record<Locale, Record<'privacy' | 'microphone' | 'help' | 'about', SettingsArticle>> = {
  "ru": {
    "microphone": {
      "title": "Микрофон: впускаем звуки",
      "sections": [
        {
          "paragraphs": [
            "Обычно FIELD использует встроенный микрофон телефона. Гарнитура или внешний микрофон могут быть выбраны устройством как источник звука.",
            "Чтобы записать сэмпл, разрешите FIELD доступ к микрофону. Это нужно, чтобы поймать голос, дождь, шуршание пакета или очень убедительное соло чайника."
          ]
        },
        {
          "paragraphs": [
            "FIELD не включает микрофон тайком. Запись запускаете вы, и во время неё на экране видно живой сигнал.",
            "После остановки записи микрофон освобождается. Проверка доступа ниже тоже не создаёт и не сохраняет запись."
          ]
        },
        {
          "heading": "Не получилось?",
          "paragraphs": [
            "Проверьте доступ к микрофону в настройках браузера или приложения, через которое открыт FIELD, и попробуйте ещё раз."
          ]
        }
      ]
    },
    "about": {
      "title": "О FIELD",
      "sections": [
        {
          "heading": "Что такое FIELD",
          "paragraphs": [
            "FIELD — бесплатное приложение для записи и исследования звуков. Запиши находку, обрежь фрагмент, попробуй эффекты и сохрани её в Library. В Daily каждый день появляется задание с другой иллюстрацией."
          ]
        },
        {
          "heading": "Field recordings",
          "paragraphs": [
            "Полевые записи — звуки вне студии: птицы, улица, шаги, вода или скрип двери. Из них получаются сэмплы, композиции и звуковые воспоминания. Музыкальная подготовка не нужна."
          ]
        },
        {
          "heading": "Tune Tots Lab",
          "paragraphs": [
            "FIELD создан Николой Ченом — музыкантом, композитором и преподавателем Tune Tots Lab, экспериментальной музыкальной лаборатории для детей. Play · Improvise · Create: исследуем музыку через игру и собственное творчество."
          ]
        },
        {
          "heading": "Сохранить или поделиться",
          "paragraphs": [
            "Library хранит личные записи на этом устройстве. World — общая карта звуков по городам. Tune Tots Group — закрытая учебная группа. Публикация происходит только после твоего подтверждения; запись можно оставить приватной."
          ]
        },
        {
          "heading": "Бесплатно",
          "paragraphs": [
            "Запись, редактирование и доступные функции FIELD бесплатны. Добровольная поддержка помогает развивать проект. Официальные контакты находятся в разделе «Ссылки»."
          ]
        }
      ]
    },
    "privacy": {
      "title": "Ваши звуки — ваш выбор",
      "sections": [
        {
          "heading": "Личные записи",
          "paragraphs": [
            "Аудио и карточки Library хранятся на этом устройстве. Сохранение не публикует запись. Удаление локальной копии не удаляет её публикацию: сначала убери её из World, если она больше не должна быть публичной."
          ]
        },
        {
          "heading": "Публикация",
          "paragraphs": [
            "С твоего согласия World получает WAV, название, три emoji и выбранный город. Публичную запись можно слушать, скачивать; она также отправляется в Telegram FIELD World. Group отправляет WAV в выбранную закрытую учебную группу."
          ]
        },
        {
          "heading": "Место и поиск",
          "paragraphs": [
            "Город выбирается вручную, без GPS. World показывает центр города, а не место записи. Поиск идёт через FIELD по каталогу GeoNames; текст запроса не отправляется внешнему геокодеру."
          ]
        },
        {
          "heading": "Доступ",
          "paragraphs": [
            "Telegram подтверждает аккаунт для World и Group. Микрофон включается только для запущенной тобой записи или проверки доступа. Рекламные трекеры и аналитика не подключены."
          ]
        }
      ]
    },
    "help": {
      "title": "Помощь",
      "sections": [
        {
          "heading": "Первая запись",
          "paragraphs": [
            "Нажми кнопку записи и разреши микрофон. Останови запись, прослушай, обрежь и попробуй FX. Добавь три emoji, название и стиль. Сохрани приватно либо подтверди публикацию в World или своей Group."
          ]
        },
        {
          "heading": "Не получается?",
          "paragraphs": [
            "Проверь доступ к микрофону и громкость. Если сессия Telegram истекла, закрой FIELD и снова открой через бота. Для публикации нужен интернет; не удаляй Library и не очищай данные приложения."
          ]
        },
        {
          "heading": "Связаться",
          "paragraphs": [
            "Сообщи модель телефона, последовательность действий и текст ошибки. Контакты — в разделе «Ссылки». Аудио присылай только по своему желанию."
          ]
        }
      ]
    }
  },
  "en": {
    "microphone": {
      "title": "Microphone: let the sounds in",
      "sections": [
        {
          "paragraphs": [
            "FIELD normally uses your device microphone. A headset or external microphone may be selected by the device.",
            "Allow microphone access to catch a voice, rain, a rustling bag, or a surprisingly convincing kettle solo."
          ]
        },
        {
          "paragraphs": [
            "FIELD does not turn the microphone on secretly. You start recording and see a live signal while it runs.",
            "The microphone is released after recording. The access check below does not create or save a recording."
          ]
        },
        {
          "heading": "No luck?",
          "paragraphs": [
            "Check microphone permission in the browser or app that opened FIELD, then try again."
          ]
        }
      ]
    },
    "about": {
      "title": "About FIELD",
      "sections": [
        {
          "heading": "What is FIELD?",
          "paragraphs": [
            "FIELD is a free app for recording and exploring sounds. Capture a find, trim it, try effects and keep it in Library. Daily offers a recording prompt with a different illustration each day."
          ]
        },
        {
          "heading": "Field recordings",
          "paragraphs": [
            "Field recordings capture sound outside a studio: birds, streets, footsteps, water or a creaking door. They can become samples, compositions and sound memories. No musical training is needed."
          ]
        },
        {
          "heading": "Tune Tots Lab",
          "paragraphs": [
            "FIELD was created by Nikola Chen, musician, composer and teacher at Tune Tots Lab, an experimental music laboratory for children. Play · Improvise · Create: explore music through play and making your own work."
          ]
        },
        {
          "heading": "Keep or share",
          "paragraphs": [
            "Library keeps private recordings on this device. World is a shared city sound map. Tune Tots Group is a private learning group. Publishing requires your confirmation; you can always keep a recording private."
          ]
        },
        {
          "heading": "Free",
          "paragraphs": [
            "Recording, editing and the available FIELD features are free. Optional donations support the project. Official contacts are in Links."
          ]
        }
      ]
    },
    "privacy": {
      "title": "Your sounds, your choice",
      "sections": [
        {
          "heading": "Private recordings",
          "paragraphs": [
            "Library audio and cards stay on this device. Saving does not publish them. Deleting a local copy does not remove a publication; remove it from World first if it should no longer be public."
          ]
        },
        {
          "heading": "Publishing",
          "paragraphs": [
            "With your consent, World receives WAV, title, three emoji and the selected city. Public audio can be played and downloaded and is also sent to Telegram FIELD World. Group sends WAV to your selected private learning group."
          ]
        },
        {
          "heading": "Location and search",
          "paragraphs": [
            "Choose a city manually, without GPS. World shows its centre, not the recording location. FIELD searches its GeoNames catalogue; query text is not sent to an external geocoder."
          ]
        },
        {
          "heading": "Access",
          "paragraphs": [
            "Telegram authenticates your account for World and Group. Microphone access is used for recording or a permission check you start. No advertising trackers or analytics are connected."
          ]
        }
      ]
    },
    "help": {
      "title": "Help",
      "sections": [
        {
          "heading": "Your first recording",
          "paragraphs": [
            "Tap Record and allow the microphone. Stop, listen, trim and try FX. Add three emoji, a title and a style. Keep it private or confirm publication to World or your Group."
          ]
        },
        {
          "heading": "Troubleshooting",
          "paragraphs": [
            "Check microphone permission and volume. If your Telegram session expired, close FIELD and reopen it through the bot. Publishing needs internet; do not delete Library or clear app data."
          ]
        },
        {
          "heading": "Contact",
          "paragraphs": [
            "Tell us the phone model, steps and error text. Contacts are in Links. Share audio only if you choose to."
          ]
        }
      ]
    }
  },
  "hy": {
    "microphone": {
      "title": "Միկրոֆոն՝ ներս թողնենք ձայները",
      "sections": [
        {
          "paragraphs": [
            "FIELD-ը սովորաբար օգտագործում է սարքի ներկառուցված միկրոֆոնը։ Արտաքին միկրոֆոնը կարող է ընտրվել սարքի կողմից։",
            "Թույլատրեք մուտքը՝ ձայն, անձրև կամ թեյնիկի համոզիչ սոլոն որսալու համար։"
          ]
        },
        {
          "paragraphs": [
            "FIELD-ը միկրոֆոնը գաղտնի չի միացնում։ Դուք եք սկսում ձայնագրումը և տեսնում կենդանի ազդանշանը։",
            "Ստուգումը ձայնագրություն չի ստեղծում և անմիջապես ազատում է միկրոֆոնը։"
          ]
        },
        {
          "heading": "Չստացվե՞ց",
          "paragraphs": [
            "Ստուգեք միկրոֆոնի թույլտվությունը դիտարկիչի կամ FIELD-ը բացած հավելվածի կարգավորումներում։"
          ]
        }
      ]
    },
    "about": {
      "title": "FIELD-ի մասին",
      "sections": [
        {
          "heading": "Ի՞նչ է FIELD-ը",
          "paragraphs": [
            "FIELD-ն անվճար հավելված է ձայներ գրանցելու և ուսումնասիրելու համար։ Ձայնագրիր, կտրիր, փորձիր էֆեկտները և պահիր Ձայնադարանում։ Ամեն օր առաջադրանքն ունի այլ նկար։"
          ]
        },
        {
          "heading": "Field recordings",
          "paragraphs": [
            "Դաշտային ձայնագրությունները ստուդիայից դուրս լսվող ձայներն են՝ թռչուններ, փողոց, քայլեր, ջուր կամ դռան ճռռոց։ Դրանք կարող են դառնալ սեմփլներ, ստեղծագործություններ և հիշողություններ։ Երաժշտական կրթություն պետք չէ։"
          ]
        },
        {
          "heading": "Tune Tots Lab",
          "paragraphs": [
            "FIELD-ը ստեղծել է երաժիշտ, կոմպոզիտոր և մանկավարժ Նիկոլա Չենը՝ Tune Tots Lab մանկական փորձարարական երաժշտական լաբորատորիայի հիմնադիրը։ Play · Improvise · Create՝ սովորել խաղի և սեփական ստեղծագործության միջոցով։"
          ]
        },
        {
          "heading": "Պահել կամ կիսվել",
          "paragraphs": [
            "Ձայնադարանը պահում է անձնական ձայներն այս սարքում։ World-ը քաղաքների ընդհանուր ձայնային քարտեզ է։ Tune Tots Group-ը փակ ուսումնական խումբ է։ Հրապարակումը պահանջում է քո հաստատումը։"
          ]
        },
        {
          "heading": "Անվճար",
          "paragraphs": [
            "Ձայնագրումը, խմբագրումը և FIELD-ի հասանելի գործառույթներն անվճար են։ Կամավոր աջակցությունը օգնում է նախագծին։ Կոնտակտները՝ Հղումներ բաժնում։"
          ]
        }
      ]
    },
    "privacy": {
      "title": "Քո ձայները՝ քո ընտրությունը",
      "sections": [
        {
          "heading": "Անձնական ձայնագրություններ",
          "paragraphs": [
            "Ձայնադարանի ֆայլերը պահվում են այս սարքում։ Պահելը չի հրապարակում։ Տեղական պատճենը ջնջելը չի հեռացնում հրապարակումը․ անհրաժեշտության դեպքում նախ հեռացրու այն World-ից։"
          ]
        },
        {
          "heading": "Հրապարակում",
          "paragraphs": [
            "Քո համաձայնությամբ World-ը ստանում է WAV, անուն, երեք էմոջի և ընտրված քաղաքը։ Հանրային ձայնը հնարավոր է լսել և ներբեռնել, այն ուղարկվում է նաև Telegram FIELD World։ Group-ը WAV-ն ուղարկում է ընտրված փակ ուսումնական խմբին։"
          ]
        },
        {
          "heading": "Տեղ և որոնում",
          "paragraphs": [
            "Քաղաքն ընտրվում է ձեռքով՝ առանց GPS-ի։ World-ը ցույց է տալիս քաղաքի կենտրոնը։ FIELD-ն որոնում է GeoNames կատալոգում․ հարցումը չի ուղարկվում արտաքին գեոկոդավորման ծառայության։"
          ]
        },
        {
          "heading": "Մուտք",
          "paragraphs": [
            "Telegram-ը հաստատում է հաշիվը World և Group-ի համար։ Միկրոֆոնն օգտագործվում է քո սկսած ձայնագրության կամ ստուգման ժամանակ։ Գովազդային հետևում և վերլուծական ծառայություններ միացված չեն։"
          ]
        }
      ]
    },
    "help": {
      "title": "Օգնություն",
      "sections": [
        {
          "heading": "Առաջին ձայնագրությունը",
          "paragraphs": [
            "Սեղմիր ձայնագրել և թույլատրի միկրոֆոնը։ Կանգնեցրու, լսիր, կտրիր և փորձիր FX։ Ավելացրու երեք էմոջի, անուն և ոճ։ Պահիր անձնական կամ հաստատիր World/Group հրապարակումը։"
          ]
        },
        {
          "heading": "Խնդիրների դեպքում",
          "paragraphs": [
            "Ստուգիր միկրոֆոնի թույլտվությունն ու ձայնը։ Telegram նիստի ավարտի դեպքում փակիր FIELD-ը և բացիր բոտից։ Հրապարակման համար ինտերնետ է պետք․ մի ջնջիր Ձայնադարանը կամ հավելվածի տվյալները։"
          ]
        },
        {
          "heading": "Կապ",
          "paragraphs": [
            "Ուղարկիր հեռախոսի մոդելը, քայլերը և սխալի տեքստը։ Կոնտակտները՝ Հղումներ բաժնում։ Ձայնը ուղարկիր միայն ցանկության դեպքում։"
          ]
        }
      ]
    }
  },
  "zh-TW": {
    "microphone": {
      "title": "麥克風：讓聲音進來",
      "sections": [
        {
          "paragraphs": [
            "FIELD 通常使用裝置內建麥克風；裝置也可能選擇耳機或外接麥克風。",
            "允許麥克風，就能捕捉人聲、雨聲、塑膠袋，或很有說服力的熱水壺獨奏。"
          ]
        },
        {
          "paragraphs": [
            "FIELD 不會偷偷開啟麥克風。錄音由你開始，畫面會顯示即時訊號。",
            "錄音與權限檢查完成後都會釋放麥克風；檢查不會建立或儲存錄音。"
          ]
        },
        {
          "heading": "還是不行？",
          "paragraphs": [
            "請在瀏覽器或開啟 FIELD 的應用程式設定中檢查麥克風權限。"
          ]
        }
      ]
    },
    "about": {
      "title": "關於 FIELD",
      "sections": [
        {
          "heading": "FIELD 是什麼？",
          "paragraphs": [
            "FIELD 是免費的聲音錄製與探索應用程式。錄下發現、裁切、試用效果，再存到聲音庫。每日挑戰每天提供不同的插圖與錄音任務。"
          ]
        },
        {
          "heading": "Field recordings",
          "paragraphs": [
            "田野錄音捕捉錄音室以外的聲音：鳥、街道、腳步、水或門的吱呀聲。它們能成為取樣、作品與聲音記憶，無須音樂訓練。"
          ]
        },
        {
          "heading": "Tune Tots Lab",
          "paragraphs": [
            "FIELD 由音樂家、作曲家及教師 Nikola Chen 創作。他創辦了兒童實驗音樂實驗室 Tune Tots Lab。Play · Improvise · Create：透過遊戲和自己的創作探索音樂。"
          ]
        },
        {
          "heading": "保留或分享",
          "paragraphs": [
            "聲音庫保留此裝置的私人錄音。World 是共享的城市聲音地圖。Tune Tots Group 是私人學習群組。發佈需要你的確認，也可以只保留私人錄音。"
          ]
        },
        {
          "heading": "免費",
          "paragraphs": [
            "錄音、編輯與 FIELD 的現有功能免費。自願贊助支持專案發展。官方聯絡方式在「連結」。"
          ]
        }
      ]
    },
    "privacy": {
      "title": "你的聲音，由你決定",
      "sections": [
        {
          "heading": "私人錄音",
          "paragraphs": [
            "聲音庫的音訊與卡片存於此裝置。儲存不會發佈。刪除本機副本不會移除公開發佈；若不再希望公開，請先從 World 移除。"
          ]
        },
        {
          "heading": "發佈",
          "paragraphs": [
            "經你同意，World 接收 WAV、標題、三個 emoji 與所選城市。公開音訊可播放、下載，也會送至 Telegram FIELD World。Group 將 WAV 傳到所選私人學習群組。"
          ]
        },
        {
          "heading": "位置與搜尋",
          "paragraphs": [
            "手動選擇城市，不使用 GPS。World 顯示城市中心，不是錄音地點。FIELD 搜尋自己的 GeoNames 目錄，不會把查詢傳到外部地理編碼服務。"
          ]
        },
        {
          "heading": "存取",
          "paragraphs": [
            "Telegram 為 World 和 Group 驗證帳號。麥克風只用於你啟動的錄音或權限檢查。沒有連接廣告追蹤或分析服務。"
          ]
        }
      ]
    },
    "help": {
      "title": "幫助",
      "sections": [
        {
          "heading": "第一段錄音",
          "paragraphs": [
            "點錄音並允許麥克風。停止、聆聽、裁切並試用 FX。加入三個 emoji、標題與風格。私人儲存，或確認發佈至 World 或你的 Group。"
          ]
        },
        {
          "heading": "遇到問題？",
          "paragraphs": [
            "檢查麥克風權限和音量。若 Telegram 工作階段到期，關閉 FIELD 並從機器人重新開啟。發佈需要網路；不要刪除聲音庫或清除應用程式資料。"
          ]
        },
        {
          "heading": "聯絡",
          "paragraphs": [
            "告訴我們手機型號、操作步驟與錯誤文字。聯絡方式在「連結」。僅在你願意時傳送音訊。"
          ]
        }
      ]
    }
  }
};
export const settingsContent = (locale: Locale) => content[locale];
