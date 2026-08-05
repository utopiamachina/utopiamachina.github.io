/** @typedef {"accepted" | "rejected" | null} AnalyticsConsent */

/** @type {string} */
const GOOGLE_ANALYTICS_ID = "G-81ZLBCHE37";
/** @type {string} */
const ANALYTICS_CONSENT_KEY = "utopia-machina-analytics-consent";
/** @type {string} */
const GOOGLE_ANALYTICS_DISABLE_PROPERTY = `ga-disable-${GOOGLE_ANALYTICS_ID}`;

/**
 * Read the saved analytics preference without assuming localStorage is available.
 * @returns {AnalyticsConsent}
 */
const getAnalyticsConsent = () => {
  try {
    /** @type {string | null} */
    const savedConsent = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);

    return savedConsent === "accepted" || savedConsent === "rejected" ? savedConsent : null;
  } catch {
    return null;
  }
};

/**
 * Save the analytics preference locally when browser storage is available.
 * @param {Exclude<AnalyticsConsent, null>} consent
 * @returns {void}
 */
const saveAnalyticsConsent = (consent) => {
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, consent);
  } catch {
    // Consent still applies for this page view when storage is unavailable.
  }
};

/**
 * Extract a cookie name from a document.cookie entry.
 * @param {string} cookie
 * @returns {string}
 */
const getCookieName = (cookie) => cookie.split("=")[0].trim();

/**
 * Identify cookies created by Google Analytics.
 * @param {string} cookieName
 * @returns {boolean}
 */
const isGoogleAnalyticsCookie = (cookieName) => {
  return cookieName === "_ga" || cookieName.startsWith("_ga_");
};

/**
 * Delete first-party Google Analytics cookies for the current hostname.
 * @returns {void}
 */
const clearGoogleAnalyticsCookies = () => {
  /** @type {string[]} */
  const analyticsCookieNames = document.cookie
    .split(";")
    .map(getCookieName)
    .filter(isGoogleAnalyticsCookie);
  /** @type {string} */
  const hostname = window.location.hostname;

  /**
   * Expire one analytics cookie across likely domain scopes.
   * @param {string} cookieName
   * @returns {void}
   */
  const expireAnalyticsCookie = (cookieName) => {
    document.cookie = `${cookieName}=; Max-Age=0; path=/; SameSite=Lax`;

    if (hostname) {
      document.cookie = `${cookieName}=; Max-Age=0; path=/; domain=${hostname}; SameSite=Lax`;
      document.cookie = `${cookieName}=; Max-Age=0; path=/; domain=.${hostname}; SameSite=Lax`;
    }
  };

  analyticsCookieNames.forEach(expireAnalyticsCookie);
};

/**
 * Dynamically initialise and load GA4 after explicit consent.
 * @returns {void}
 */
const loadGoogleAnalytics = () => {
  window[GOOGLE_ANALYTICS_DISABLE_PROPERTY] = false;

  if (typeof window.gtag === "function") {
    window.gtag("consent", "update", { analytics_storage: "granted" });
    window.gtag("config", GOOGLE_ANALYTICS_ID);
    return;
  }

  /** @type {unknown[][]} */
  const dataLayer = Array.isArray(window.dataLayer) ? window.dataLayer : [];
  window.dataLayer = dataLayer;

  /**
   * Queue Google Analytics commands until gtag.js is ready.
   * @param {...unknown} args
   * @returns {void}
   */
  const gtag = (...args) => {
    dataLayer.push(args);
  };

  window.gtag = gtag;
  gtag("consent", "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied"
  });
  gtag("js", new Date());
  gtag("config", GOOGLE_ANALYTICS_ID, {
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });

  /** @type {HTMLScriptElement} */
  const analyticsScript = document.createElement("script");
  analyticsScript.async = true;
  analyticsScript.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GOOGLE_ANALYTICS_ID)}`;
  analyticsScript.dataset.googleAnalytics = "true";
  document.head.append(analyticsScript);
};

/**
 * Stop analytics collection and remove its first-party cookies.
 * @returns {void}
 */
const disableGoogleAnalytics = () => {
  window[GOOGLE_ANALYTICS_DISABLE_PROPERTY] = true;

  if (typeof window.gtag === "function") {
    window.gtag("consent", "update", { analytics_storage: "denied" });
  }

  clearGoogleAnalyticsCookies();
};

/**
 * Build the shared consent banner.
 * @returns {HTMLElement}
 */
const createCookieConsentBanner = () => {
  /** @type {HTMLElement} */
  const banner = document.createElement("aside");
  banner.id = "cookie-consent";
  banner.className = "cookie-consent";
  banner.hidden = true;
  banner.tabIndex = -1;
  banner.setAttribute("role", "region");
  banner.setAttribute("aria-labelledby", "cookie-consent-title");
  banner.innerHTML = `
    <div class="cookie-consent-copy">
      <strong id="cookie-consent-title">Optional analytics</strong>
      <p>May we use Google Analytics to understand how people use this site? It stays off unless you accept. <a href="privacy.html#cookies-and-analytics">Privacy details</a></p>
    </div>
    <div class="cookie-consent-actions">
      <button type="button" class="cookie-consent-button" data-consent="accept">Accept analytics</button>
      <button type="button" class="cookie-consent-button" data-consent="reject">Reject non-essential</button>
    </div>
  `;
  document.body.append(banner);

  return banner;
};

/** @type {AnalyticsConsent} */
let analyticsConsent = getAnalyticsConsent();
/** @type {HTMLElement} */
const cookieConsentBanner = createCookieConsentBanner();
/** @type {HTMLButtonElement | null} */
const acceptAnalyticsButton = cookieConsentBanner.querySelector('[data-consent="accept"]');
/** @type {HTMLButtonElement | null} */
const rejectAnalyticsButton = cookieConsentBanner.querySelector('[data-consent="reject"]');

/**
 * Reveal the consent controls, optionally moving focus when opened deliberately.
 * @param {boolean} moveFocus
 * @returns {void}
 */
const showCookieConsentBanner = (moveFocus = false) => {
  cookieConsentBanner.hidden = false;

  if (moveFocus) {
    cookieConsentBanner.focus();
  }
};

/** @returns {void} */
const hideCookieConsentBanner = () => {
  cookieConsentBanner.hidden = true;
};

/**
 * Apply and store a visitor's analytics preference.
 * @param {Exclude<AnalyticsConsent, null>} consent
 * @returns {void}
 */
const applyAnalyticsConsent = (consent) => {
  analyticsConsent = consent;
  saveAnalyticsConsent(consent);

  if (consent === "accepted") {
    loadGoogleAnalytics();
  } else {
    disableGoogleAnalytics();
  }

  hideCookieConsentBanner();
};

/** @returns {void} */
const handleAcceptAnalytics = () => {
  applyAnalyticsConsent("accepted");
};

/** @returns {void} */
const handleRejectAnalytics = () => {
  applyAnalyticsConsent("rejected");
};

/**
 * Open cookie settings from a persistent footer link.
 * @param {Event} event
 * @returns {void}
 */
const handleCookieSettingsClick = (event) => {
  event.preventDefault();
  showCookieConsentBanner(true);
};

/**
 * Attach settings behavior to a footer link.
 * @param {Element} settingsLink
 * @returns {void}
 */
const bindCookieSettingsLink = (settingsLink) => {
  settingsLink.addEventListener("click", handleCookieSettingsClick);
};

acceptAnalyticsButton?.addEventListener("click", handleAcceptAnalytics);
rejectAnalyticsButton?.addEventListener("click", handleRejectAnalytics);
document.querySelectorAll("[data-cookie-settings]").forEach(bindCookieSettingsLink);

if (analyticsConsent === "accepted") {
  loadGoogleAnalytics();
} else if (analyticsConsent === "rejected") {
  disableGoogleAnalytics();
} else {
  showCookieConsentBanner();
}

/** @type {HTMLFormElement | null} */
const newsletterForm = document.querySelector("[data-newsletter-form]");

if (newsletterForm) {
  /** @type {HTMLInputElement | null} */
  const emailInput = newsletterForm.querySelector('input[name="EMAIL"]');
  /** @type {HTMLElement | null} */
  const newsletterDetails = newsletterForm.querySelector("[data-newsletter-details]");
  /** @type {HTMLButtonElement | null} */
  const newsletterButton = newsletterForm.querySelector('button[type="submit"]');
  /** @type {HTMLInputElement | null} */
  const consentInput = newsletterDetails?.querySelector("input") ?? null;

  /** @returns {void} */
  const expandNewsletter = () => {
    if (!newsletterDetails || newsletterForm.classList.contains("is-expanded")) {
      return;
    }

    newsletterForm.classList.add("is-expanded");
    newsletterDetails.setAttribute("aria-hidden", "false");
    newsletterButton?.setAttribute("aria-expanded", "true");
  };

  /** @returns {void} */
  const handleNewsletterEmailInput = () => {
    if (emailInput?.value.trim()) {
      expandNewsletter();
    }
  };

  /**
   * Reveal the extra subscription controls on the first button press.
   * @param {MouseEvent} event
   * @returns {void}
   */
  const handleNewsletterButtonClick = (event) => {
    if (!newsletterForm.classList.contains("is-expanded")) {
      event.preventDefault();
      expandNewsletter();

      if (emailInput?.value.trim()) {
        consentInput?.focus();
      } else {
        emailInput?.focus();
      }
    }
  };

  /**
   * Prevent keyboard submission from bypassing the progressive disclosure step.
   * @param {SubmitEvent} event
   * @returns {void}
   */
  const handleNewsletterSubmit = (event) => {
    if (!newsletterForm.classList.contains("is-expanded")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      expandNewsletter();
      consentInput?.focus();
    }
  };

  emailInput?.addEventListener("input", handleNewsletterEmailInput);
  newsletterButton?.addEventListener("click", handleNewsletterButtonClick);
  newsletterForm.addEventListener("submit", handleNewsletterSubmit, true);
}

/**
 * Notify Brevo when Cloudflare Turnstile has produced a token.
 * @param {string} _token
 * @returns {void}
 */
window.handleCaptchaResponse = (_token) => {
  /** @type {HTMLElement | null} */
  const captcha = document.getElementById("sib-captcha");

  captcha?.dispatchEvent(new Event("captchaChange"));
  window.grecaptcha = window.turnstile;
};

/**
 * Fill an automatic copyright year placeholder.
 * @param {Element} item
 * @returns {void}
 */
const updateCopyrightYear = (item) => {
  item.textContent = String(new Date().getFullYear());
};

document.querySelectorAll("[data-year]").forEach(updateCopyrightYear);
