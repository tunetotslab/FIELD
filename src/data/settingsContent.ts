import type { Locale } from "../i18n";
import { aboutContent } from './about';
export interface ArticleSection { heading?: string; paragraphs: string[]; }
export interface SettingsArticle { title: string; intro?: string; sections: ArticleSection[]; }
const content: Record<Locale, Record<'privacy' | 'microphone' | 'help', SettingsArticle>> = {
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
    "privacy": {
      "title": "Ваши звуки — ваш выбор",
      "sections": [
        {
          "heading": "Личные записи",
          "paragraphs": [
            "Аудио и карточки Library сохраняются на устройстве. После входа новые записи также синхронизируются с личной библиотекой аккаунта в Cloudflare D1/R2 и доступны в Telegram, Safari и на других телефонах. Старые записи добавляются через подтверждение в Library на устройстве, где они хранятся. Без входа записи остаются только локальными. Удаление синхронизированной записи убирает её из Library на всех устройствах. Резервные аудиобайты пока сохраняются приватно для восстановления; это не полное стирание. Для полного удаления обратись в поддержку. Если нажать Export/Share внутри Telegram, WAV передаётся через FIELD в твой личный чат с ботом — его можно сохранить или переслать оттуда. Это не публикация в World или Group. Сохранение не публикует запись. Удаление локальной копии не удаляет её публикацию: сначала убери её из World, если она больше не должна быть публичной."
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
    "privacy": {
      "title": "Your sounds, your choice",
      "sections": [
        {
          "heading": "Private recordings",
          "paragraphs": [
            "Library audio and cards are saved on this device. After sign-in, new recordings also sync to your private account Library in Cloudflare D1/R2 and become available in Telegram, Safari and on other phones. Add older recordings through the confirmation in Library on the device holding them. Without sign-in, recordings remain local. Removing a synced recording hides it from Library on all devices. Recovery audio bytes currently remain private; this is not permanent erasure. Contact support for full removal. Tapping Export/Share inside Telegram transfers the WAV through FIELD to your own private bot chat, where you can save or forward it. This does not publish to World or Group. Saving does not publish them. Deleting a local copy does not remove a publication; remove it from World first if it should no longer be public."
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
    "privacy": {
      "title": "Քո ձայները՝ քո ընտրությունը",
      "sections": [
        {
          "heading": "Անձնական ձայնագրություններ",
          "paragraphs": [
            "Ձայնադարանի ֆայլերը պահվում են այս սարքում։ Մուտքից հետո նոր ձայնագրությունները համաժամացվում են նաև հաշվի անձնական ձայնադարանին՝ Cloudflare D1/R2-ում, և հասանելի են Telegram-ում, Safari-ում ու մյուս հեռախոսներում։ Հին ձայնագրությունները ավելացրու հաստատմամբ այն սարքի Library-ից, որտեղ դրանք պահված են։ Առանց մուտքի ձայները մնում են տեղական։ Համաժամացված ձայնագրությունը հեռացնելը այն թաքցնում է բոլոր սարքերի ձայնադարանից։ Վերականգնման աուդիոբայթերը առայժմ պահվում են անձնական ձևով․ ամբողջական ջնջման համար կապվիր աջակցությանը։ Telegram-ում Export/Share սեղմելիս WAV-ը FIELD-ի միջոցով ուղարկվում է բոտի հետ քո անձնական չատին՝ պահելու կամ փոխանցելու համար։ Սա World կամ Group-ի հրապարակում չէ։ Պահելը չի հրապարակում։ Տեղական պատճենը ջնջելը չի հեռացնում հրապարակումը․ անհրաժեշտության դեպքում նախ հեռացրու այն World-ից։"
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
    "privacy": {
      "title": "你的聲音，由你決定",
      "sections": [
        {
          "heading": "私人錄音",
          "paragraphs": [
            "聲音庫的音訊與卡片儲存在此裝置。登入後，新錄音也會同步至 Cloudflare D1/R2 中的私人帳號聲音庫，可在 Telegram、Safari 和其他手機使用。舊錄音須在保存它們的裝置上透過 Library 確認加入。未登入時，錄音只儲存在本機。移除已同步錄音會將它從所有裝置的聲音庫隱藏。復原用音訊目前仍以私人方式保留；這不是永久抹除。若需完整刪除，請聯絡支援。在 Telegram 中按 Export/Share，WAV 會透過 FIELD 傳送到你與機器人的私人聊天，供你儲存或轉傳。這不會發佈到 World 或 Group。儲存不會發佈。刪除本機副本不會移除公開發佈；若不再希望公開，請先從 World 移除。"
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
export const settingsContent = (locale: Locale) => ({...content[locale], about: aboutContent[locale]});
