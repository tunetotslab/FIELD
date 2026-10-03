import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { API_URL } from "../config";
import { fetchWithDeadline } from "../network";
import { telegram } from "../telegram";
import { TelegramLink } from "./TelegramLink";
import {
  authenticationHeaders,
  currentSession,
  setSession,
  type FieldSession,
} from "../auth/session";
const copy = {
  en: {
    title: "FIELD account",
    guest:
      "Private recording works offline without an account. Sign in to use World and your Tune Tots Group.",
    login: "Continue with Telegram",
    code: "Compare this code with the FIELD bot. Approve only a login you started yourself.",
    waiting: "Waiting for your confirmation in Telegram…",
    confirm: "Continue as",
    logout: "Sign out",
    failed:
      "Login could not finish. Your private Library stays on this browser. Try again.",
    cancel: "Cancel",
    saved: "Your private Library stays on this browser when you sign out.",
  },
  ru: {
    title: "Аккаунт FIELD",
    guest:
      "Приватная запись работает без аккаунта и интернета. Войдите для World и вашей Tune Tots Group.",
    login: "Войти через Telegram",
    code: "Сравните этот код с кодом бота FIELD. Подтверждайте только вход, который начали сами.",
    waiting: "Ждём вашего подтверждения в Telegram…",
    confirm: "Продолжить как",
    logout: "Выйти",
    failed:
      "Не удалось завершить вход. Личная Library остаётся на этом браузере. Попробуйте снова.",
    cancel: "Отмена",
    saved: "При выходе личная Library остаётся на этом браузере.",
  },
  hy: {
    title: "FIELD հաշիվ",
    guest:
      "Անձնական ձայնագրությունը հասանելի է անցանց՝ առանց հաշվի։ Մուտք գործեք World և Tune Tots Group-ի համար։",
    login: "Մուտք Telegram-ով",
    code: "Համեմատեք կոդը FIELD բոտի կոդի հետ։ Հաստատեք միայն ձեր սկսած մուտքը։",
    waiting: "Սպասում ենք Telegram-ում հաստատմանը…",
    confirm: "Շարունակել որպես",
    logout: "Դուրս գալ",
    failed:
      "Մուտքը չհաջողվեց։ Անձնական Library-ն մնում է այս դիտարկիչում։ Փորձեք կրկին։",
    cancel: "Չեղարկել",
    saved: "Դուրս գալուց անձնական Library-ն մնում է այս դիտարկիչում։",
  },
  "zh-TW": {
    title: "FIELD 帳號",
    guest: "無需帳號即可離線私人錄音。登入後可使用 World 和 Tune Tots Group。",
    login: "使用 Telegram 登入",
    code: "比對此代碼與 FIELD 機器人的代碼。只確認你自己發起的登入。",
    waiting: "等待你在 Telegram 確認…",
    confirm: "繼續使用",
    logout: "登出",
    failed: "無法完成登入。私人 Library 仍保存在此瀏覽器。請重試。",
    cancel: "取消",
    saved: "登出後私人 Library 仍保存在此瀏覽器。",
  },
};
type Challenge = {
  id: string;
  proof: string;
  code: string;
  expiresAt: number;
  url: string;
};
class LoginError extends Error {
  constructor(readonly status: number) {
    super("Native login unavailable");
  }
}
async function request<T>(
  path: string,
  body: object,
  signal?: AbortSignal,
  authorized = false,
): Promise<T> {
  const response = await fetchWithDeadline(
    `${API_URL}/auth/browser/${path}`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(authorized ? authenticationHeaders() : {}),
      },
      body: JSON.stringify(body),
      signal,
    },
    15000,
  );
  if (!response.ok) throw new LoginError(response.status);
  return response.json();
}
export function FieldAccount() {
  const { locale } = useI18n(),
    c = copy[locale];
  const [account, setAccount] = useState(currentSession()),
    [challenge, setChallenge] = useState<Challenge>(),
    [approved, setApproved] = useState<{
      userId: number;
      displayName: string;
    }>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const mounted = useRef(true),
    operation = useRef(0);
  useEffect(() => {
    mounted.current = true;
    const changed = () => setAccount(currentSession());
    window.addEventListener("field-auth-changed", changed);
    return () => {
      mounted.current = false;
      operation.current++;
      window.removeEventListener("field-auth-changed", changed);
    };
  }, []);
  useEffect(() => {
    if (!challenge || approved) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      if (Date.now() >= challenge.expiresAt) {
        setError(c.failed);
        setChallenge(undefined);
        return;
      }
      try {
        const status = await request<{
          state: string;
          userId: number;
          displayName: string;
        }>(
          "status",
          { id: challenge.id, proof: challenge.proof },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        if (status.state === "approved") {
          setApproved(status);
          return;
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        if (
          error instanceof LoginError &&
          [400, 410, 503].includes(error.status)
        ) {
          setChallenge(undefined);
          setError(c.failed);
          return;
        }
      }
      timer = setTimeout(() => void check(), 4000);
    };
    void check();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [challenge, approved, c.failed]);
  if (telegram.isTelegram) return null;
  const login = async () => {
    const attempt = ++operation.current;
    setBusy(true);
    setError("");
    setApproved(undefined);
    setChallenge(undefined);
    try {
      const value = await request<Challenge>("challenge", {});
      if (!mounted.current || attempt !== operation.current) return;
      if (
        !/^[a-f0-9]{32}$/.test(value.id) ||
        !/^[A-Za-z0-9_-]{43}$/.test(value.proof) ||
        !/^\d{6}$/.test(value.code) ||
        value.url !==
          `https://t.me/field_sound_bot?start=field_web_${value.id}` ||
        !Number.isFinite(value.expiresAt)
      )
        throw Error("Invalid login");
      setChallenge(value);
    } catch {
      if (mounted.current && attempt === operation.current) setError(c.failed);
    } finally {
      if (mounted.current && attempt === operation.current) setBusy(false);
    }
  };
  const confirm = async () => {
    if (!challenge || !approved) return;
    setBusy(true);
    setError("");
    try {
      const value = await request<FieldSession>("exchange", {
        id: challenge.id,
        proof: challenge.proof,
      });
      if (value.userId !== approved.userId) throw Error("Account mismatch");
      await setSession(value);
      setChallenge(undefined);
      setApproved(undefined);
    } catch {
      setError(c.failed);
      setChallenge(undefined);
      setApproved(undefined);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const logout = async () => {
    setBusy(true);
    setError("");
    try {
      try {
        await request("logout", {}, undefined, true);
      } catch (error) {
        if (!(error instanceof LoginError) || error.status !== 401) throw error;
      }
      await setSession(undefined);
    } catch {
      setError(c.failed);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <section className="field-account">
      <strong>{c.title}</strong>
      <p>{account ? `${account.displayName} · Telegram` : c.guest}</p>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {account ? (
        <>
          <p>{c.saved}</p>
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => void logout()}
          >
            {busy ? "…" : c.logout}
          </button>
        </>
      ) : challenge ? (
        <>
          <strong className="field-login-code">{challenge.code}</strong>
          <p>{c.code}</p>
          {!approved && (
            <TelegramLink href={challenge.url}>{c.login}</TelegramLink>
          )}
          {approved ? (
            <button
              className="primary-button"
              disabled={busy}
              onClick={() => void confirm()}
            >
              {busy ? "…" : `${c.confirm} ${approved.displayName}`}
            </button>
          ) : (
            <p role="status">{c.waiting}</p>
          )}
          <button
            className="primary-button secondary"
            disabled={busy}
            onClick={() => {
              operation.current++;
              setChallenge(undefined);
              setApproved(undefined);
              setError("");
            }}
          >
            {c.cancel}
          </button>
        </>
      ) : (
        <button
          className="primary-button"
          disabled={busy}
          onClick={() => void login()}
        >
          {busy ? "…" : c.login}
        </button>
      )}
    </section>
  );
}
