import { useEffect, useState } from "react";
import { currentUserId, currentSession } from "../auth/session";
import { soundsDb } from "../storage/db";
import { useI18n, type Locale } from "../i18n";
import type { SoundRecord } from "../types";
import { Dialog } from "./Dialog";
export const libraryCopy: Record<
  Locale,
  {
    account: string;
    local: string;
    guest: string;
    login: string;
    old: string;
    confirm: string;
    approve: string;
    cancel: string;
    busy: string;
    done: string;
    failed: string;
    retry: string;
    pending: string;
    saved: string;
    delete: string;
  }
> = {
  en: {
    account: "Your account Library",
    local: "Saved on this device",
    guest:
      "Sign in through Settings to see the same private Library in Telegram, Safari and on another phone.",
    login: "Sign in",
    old: "Sync recordings from this device",
    confirm:
      "Add these device recordings to the displayed account? They will stay private and become available on your other signed-in devices. Open the Telegram FIELD Library once to bring recordings stored there into this account too.",
    approve: "Add to my private Library",
    cancel: "Cancel",
    busy: "Syncing private Library…",
    done: "Private Library is synced",
    failed:
      "Some recordings could not sync. Device copies are safe; reconnect and retry.",
    retry: "Retry sync",
    pending: "Waiting to sync",
    saved: "Saved in your private account",
    delete:
      "Remove this recording from your private Library on all synced devices? World and Group publications remain.",
  },
  ru: {
    account: "Библиотека твоего аккаунта",
    local: "Сохранено на этом устройстве",
    guest:
      "Войди через настройки, чтобы видеть одну личную Library в Telegram, Safari и на другом телефоне.",
    login: "Войти",
    old: "Синхронизировать записи этого устройства",
    confirm:
      "Добавить записи этого устройства в указанный аккаунт? Они останутся приватными и появятся на других устройствах, где ты вошёл. Чтобы перенести записи из Telegram, один раз открой там Library и подтверди их добавление в этот же аккаунт.",
    approve: "Добавить в мою личную Library",
    cancel: "Отмена",
    busy: "Синхронизируем личную Library…",
    done: "Личная Library синхронизирована",
    failed:
      "Часть записей не удалось синхронизировать. Копии на устройстве сохранены; проверь связь и повтори.",
    retry: "Повторить синхронизацию",
    pending: "Ожидает синхронизации",
    saved: "Сохранено в личном аккаунте",
    delete:
      "Удалить запись из личной Library на всех синхронизированных устройствах? Публикации в World и Group останутся.",
  },
  hy: {
    account: "Քո հաշվի ձայնադարանը",
    local: "Պահված է այս սարքում",
    guest:
      "Մուտք գործիր կարգավորումներից՝ Telegram-ում, Safari-ում և մյուս հեռախոսում նույն անձնական ձայնադարանը տեսնելու համար։",
    login: "Մուտք գործել",
    old: "Համաժամացնել այս սարքի ձայնագրությունները",
    confirm:
      "Ավելացնե՞լ այս սարքի ձայնագրությունները նշված հաշվին։ Դրանք կմնան անձնական և հասանելի կլինեն մյուս սարքերում։ Telegram-ի ձայնագրությունները փոխանցելու համար բացիր այնտեղ Library-ն և հաստատիր նույն հաշվում ավելացնելը։",
    approve: "Ավելացնել իմ անձնական ձայնադարանին",
    cancel: "Չեղարկել",
    busy: "Անձնական ձայնադարանը համաժամացվում է…",
    done: "Անձնական ձայնադարանը համաժամացված է",
    failed:
      "Որոշ ձայնագրություններ չհամաժամացվեցին։ Սարքի պատճենները պահպանված են։ Ստուգիր կապը և կրկնիր։",
    retry: "Կրկնել համաժամացումը",
    pending: "Սպասում է համաժամացման",
    saved: "Պահված է անձնական հաշվում",
    delete:
      "Հեռացնե՞լ ձայնագրությունը անձնական ձայնադարանից բոլոր համաժամացված սարքերում։ World և Group հրապարակումները կմնան։",
  },
  "zh-TW": {
    account: "你的帳號聲音庫",
    local: "已儲存在此裝置",
    guest:
      "從設定登入，即可在 Telegram、Safari 和另一支手機查看相同的私人聲音庫。",
    login: "登入",
    old: "同步此裝置的錄音",
    confirm:
      "將此裝置的錄音加入顯示的帳號？錄音仍然私人，並會出現在其他已登入的裝置。要帶入 Telegram 的錄音，請在那裡開啟 Library 並確認加入同一帳號。",
    approve: "加入我的私人聲音庫",
    cancel: "取消",
    busy: "正在同步私人聲音庫…",
    done: "私人聲音庫已同步",
    failed: "部分錄音無法同步。裝置副本仍然安全；請檢查連線後重試。",
    retry: "重試同步",
    pending: "等待同步",
    saved: "已儲存於私人帳號",
    delete:
      "從所有已同步裝置的私人聲音庫移除此錄音？World 和 Group 發佈仍會保留。",
  },
};
function accountName() {
  try {
    const raw = window.Telegram?.WebApp?.initData;
    if (raw) {
      const user = JSON.parse(new URLSearchParams(raw).get("user") || "{}");
      return user.username
        ? `@${user.username}`
        : user.first_name || String(currentUserId());
    }
  } catch {}
  return currentSession()?.displayName || String(currentUserId());
}
export function LibrarySyncControl({
  records,
  login,
}: {
  records: SoundRecord[];
  login: () => void;
}) {
  const { locale } = useI18n(),
    c = libraryCopy[locale];
  const [status, setStatus] = useState(soundsDb.status());
  const [confirming, setConfirming] = useState(false);
  const [binding, setBinding] = useState(false);
  const [bindError, setBindError] = useState(false);
  useEffect(() => {
    const refresh = () => {
      setStatus(soundsDb.status());
      setConfirming(false);
    };
    const update = () => setStatus(soundsDb.status());
    window.addEventListener("field-library-status", update);
    window.addEventListener("field-auth-changed", refresh);
    return () => {
      window.removeEventListener("field-library-status", update);
      window.removeEventListener("field-auth-changed", refresh);
    };
  }, []);
  if (!currentUserId())
    return (
      <section className="library-sync-panel">
        <p>{c.guest}</p>
        <button className="secondary-button" onClick={login}>
          {c.login}
        </button>
      </section>
    );
  const old = records.filter((r) => !r.librarySync).length;
  const pending = records.some(
    (r) =>
      r.librarySync &&
      r.librarySync.mutationId !== r.librarySync.syncedMutationId,
  );
  const adopt = async () => {
    setBinding(true);
    setBindError(false);
    try {
      await soundsDb.adoptExisting();
      setConfirming(false);
      await soundsDb.sync();
    } catch {
      setBindError(true);
    } finally {
      setBinding(false);
    }
  };
  return (
    <section className="library-sync-panel">
      <strong>
        {c.account} · {accountName()}
      </strong>
      <p role="status">
        {status.busy
          ? c.busy
          : status.error !== undefined || bindError
            ? `${c.failed} [LIBRARY:${status.error ?? "LOCAL"}]`
            : pending
              ? c.pending
              : status.completedAt && old === 0
                ? c.done
                : c.local}
      </p>
      {old > 0 && (
        <button className="primary-button" onClick={() => setConfirming(true)}>
          {c.old} · {old}
        </button>
      )}
      {status.error !== undefined && (
        <button
          className="secondary-button"
          disabled={status.busy}
          onClick={() => void soundsDb.sync()}
        >
          {c.retry}
        </button>
      )}
      {confirming && (
        <Dialog
          title={`${c.account} · ${accountName()}`}
          close={() => {
            if (!binding) setConfirming(false);
          }}
        >
          <p>{c.confirm}</p>
          <button
            className="primary-button"
            disabled={binding}
            onClick={() => void adopt()}
          >
            {binding ? c.busy : c.approve}
          </button>
          <button
            className="secondary-button"
            disabled={binding}
            onClick={() => setConfirming(false)}
          >
            {c.cancel}
          </button>
        </Dialog>
      )}
    </section>
  );
}
