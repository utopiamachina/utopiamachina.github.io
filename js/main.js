/** @typedef {"accepted" | "rejected" | null} AnalyticsConsent */
/** @typedef {Record<string, string | number | boolean>} AnalyticsEventParameters */

/** @type {string} */
const GOOGLE_ANALYTICS_ID = "G-81ZLBCHE37";
/** @type {string} */
const ANALYTICS_CONSENT_KEY = "utopia-machina-analytics-consent";
/** @type {string} */
const GOOGLE_ANALYTICS_DISABLE_PROPERTY = `ga-disable-${GOOGLE_ANALYTICS_ID}`;
/** @type {RegExp} */
const EMAIL_ADDRESS_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
/** @type {boolean} */
let googleAnalyticsReady = false;

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

/** @returns {void} */
const handleGoogleAnalyticsLoad = () => {
  googleAnalyticsReady = true;
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
  analyticsScript.addEventListener("load", handleGoogleAnalyticsLoad, { once: true });
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
 * Send one custom event only when consent is active and GA4 has finished loading.
 * Events produced earlier are discarded and never queued.
 * @param {string} eventName
 * @param {AnalyticsEventParameters} parameters
 * @returns {boolean}
 */
const trackAnalyticsEvent = (eventName, parameters) => {
  if (
    analyticsConsent !== "accepted" ||
    !googleAnalyticsReady ||
    typeof window.gtag !== "function"
  ) {
    return false;
  }

  /** @type {string} */
  const serializedParameters = JSON.stringify(parameters);

  if (EMAIL_ADDRESS_PATTERN.test(serializedParameters)) {
    return false;
  }

  window.gtag("event", eventName, parameters);
  return true;
};

/**
 * Return stable visible link text without surrounding or repeated whitespace.
 * @param {HTMLAnchorElement} link
 * @returns {string}
 */
const getAnalyticsLinkText = (link) => {
  return (link.textContent ?? "").replace(/\s+/g, " ").trim();
};

/**
 * Remove query strings, fragments, and personal destinations from a tracked URL.
 * @param {HTMLAnchorElement} link
 * @returns {string}
 */
const getAnalyticsLinkUrl = (link) => {
  try {
    /** @type {URL} */
    const url = new URL(link.href, window.location.href);

    if (url.protocol === "mailto:" || url.protocol === "tel:") {
      return url.protocol;
    }

    return url.origin === window.location.origin ? url.pathname : `${url.origin}${url.pathname}`;
  } catch {
    return "invalid-url";
  }
};

/**
 * Track one annotated link without delaying its normal navigation.
 * @param {MouseEvent} event
 * @returns {void}
 */
const handleAnalyticsLinkClick = (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  /** @type {HTMLAnchorElement | null} */
  const link = event.target.closest("a[data-analytics-event]");

  if (!link) {
    return;
  }

  /** @type {string} */
  const eventName = link.dataset.analyticsEvent ?? "";
  /** @type {string} */
  const linkLocation = link.dataset.analyticsLocation ?? "unknown";
  /** @type {string} */
  const linkUrl = getAnalyticsLinkUrl(link);
  /** @type {string} */
  const linkText = getAnalyticsLinkText(link);

  if (eventName === "steam_click") {
    trackAnalyticsEvent(eventName, {
      game: link.dataset.analyticsGame ?? "unknown",
      link_url: linkUrl,
      link_text: linkText,
      link_location: linkLocation
    });
  } else if (eventName === "lunch_strolls_interest_click" || eventName === "discord_click") {
    trackAnalyticsEvent(eventName, {
      link_url: linkUrl,
      link_text: linkText,
      link_location: linkLocation
    });
  } else if (eventName === "social_click") {
    trackAnalyticsEvent(eventName, {
      platform: link.dataset.analyticsPlatform ?? "unknown",
      link_url: linkUrl,
      link_text: linkText,
      link_location: linkLocation
    });
  } else if (eventName === "game_page_open") {
    trackAnalyticsEvent(eventName, {
      game: link.dataset.analyticsGame ?? "unknown",
      destination_path: linkUrl,
      link_location: linkLocation
    });
  }
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
document.addEventListener("click", handleAnalyticsLinkClick);

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
  /** @type {HTMLElement | null} */
  const newsletterSuccessMessage = document.getElementById("success-message");
  /** @type {HTMLElement | null} */
  const newsletterFailureMessage = document.getElementById("error-message");
  /** @type {HTMLElement | null} */
  const newsletterFormContainer = document.getElementById("sib-form-container");
  /** @type {string} */
  const newsletterFormLocation = newsletterForm.dataset.analyticsLocation ?? "unknown";
  /** @type {boolean} */
  let newsletterStarted = false;
  /** @type {boolean} */
  let newsletterSubmissionPending = false;
  /** @type {boolean} */
  let newsletterSuccessTracked = false;
  /** @type {Set<string>} */
  let visibleNewsletterErrors = new Set();

  /** @returns {AnalyticsEventParameters} */
  const getNewsletterEventParameters = () => ({
    form_name: "main_newsletter",
    form_location: newsletterFormLocation,
    newsletter_provider: "brevo"
  });

  /** @returns {void} */
  const trackNewsletterStart = () => {
    if (newsletterStarted) {
      return;
    }

    newsletterStarted = true;
    trackAnalyticsEvent("newsletter_form_start", getNewsletterEventParameters());
  };

  /** @returns {void} */
  const expandNewsletter = () => {
    trackNewsletterStart();

    if (!newsletterDetails || newsletterForm.classList.contains("is-expanded")) {
      return;
    }

    newsletterForm.classList.add("is-expanded");
    newsletterDetails.setAttribute("aria-hidden", "false");
    newsletterButton?.setAttribute("aria-expanded", "true");
  };

  /** @returns {void} */
  const handleNewsletterEmailInput = () => {
    trackNewsletterStart();

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
      return;
    }

    newsletterSubmissionPending = true;
  };

  /**
   * Confirm that Brevo received a real submission request after validation.
   * @param {PerformanceObserverEntryList} entryList
   * @returns {void}
   */
  const handleNewsletterResourceEntries = (entryList) => {
    if (!newsletterSubmissionPending) {
      return;
    }

    for (const entry of entryList.getEntries()) {
      if (entry.name.startsWith(newsletterForm.action)) {
        newsletterSubmissionPending = false;
        trackAnalyticsEvent("newsletter_form_submit", getNewsletterEventParameters());
        break;
      }
    }
  };

  /**
   * Determine whether Brevo is currently displaying a status or validation node.
   * @param {Element | null} element
   * @returns {boolean}
   */
  const isNewsletterStatusVisible = (element) => {
    if (!element) {
      return false;
    }

    /** @type {CSSStyleDeclaration} */
    const style = window.getComputedStyle(element);
    return !element.hasAttribute("hidden") && style.display !== "none" && style.visibility !== "hidden";
  };

  /**
   * Convert a Brevo field-error location into a stable, non-personal error type.
   * @param {Element} errorElement
   * @returns {string}
   */
  const getNewsletterErrorType = (errorElement) => {
    if (errorElement.closest(".sib-input")) {
      return "invalid_email";
    }

    if (errorElement.closest(".sib-optin")) {
      return "missing_consent";
    }

    if (errorElement.closest(".sib-captcha")) {
      return "captcha_failure";
    }

    return "validation_error";
  };

  /** @returns {void} */
  const inspectNewsletterStatus = () => {
    if (isNewsletterStatusVisible(newsletterSuccessMessage) && !newsletterSuccessTracked) {
      newsletterSuccessTracked = true;
      trackAnalyticsEvent("newsletter_subscription_success", {
        form_name: "main_newsletter",
        newsletter_provider: "brevo",
        confirmation_stage: "form_accepted"
      });
    }

    /** @type {Set<string>} */
    const currentErrors = new Set();

    if (isNewsletterStatusVisible(newsletterFailureMessage)) {
      currentErrors.add("submission_failure");
    }

    /** @type {NodeListOf<Element>} */
    const fieldErrors = newsletterForm.querySelectorAll(".entry__error");

    for (const errorElement of fieldErrors) {
      if (errorElement.textContent?.trim() && isNewsletterStatusVisible(errorElement)) {
        currentErrors.add(getNewsletterErrorType(errorElement));
      }
    }

    for (const errorType of currentErrors) {
      if (!visibleNewsletterErrors.has(errorType)) {
        trackAnalyticsEvent("newsletter_form_error", {
          form_name: "main_newsletter",
          error_type: errorType,
          newsletter_provider: "brevo"
        });
      }
    }

    visibleNewsletterErrors = currentErrors;
  };

  /** @type {MutationCallback} */
  const handleNewsletterStatusMutation = () => {
    inspectNewsletterStatus();
  };

  emailInput?.addEventListener("focus", trackNewsletterStart, { once: true });
  emailInput?.addEventListener("input", handleNewsletterEmailInput);
  newsletterButton?.addEventListener("click", handleNewsletterButtonClick);
  newsletterForm.addEventListener("submit", handleNewsletterSubmit, true);

  if ("PerformanceObserver" in window) {
    /** @type {PerformanceObserver} */
    const newsletterResourceObserver = new PerformanceObserver(handleNewsletterResourceEntries);
    newsletterResourceObserver.observe({ type: "resource", buffered: true });
  }

  if (newsletterFormContainer && "MutationObserver" in window) {
    /** @type {MutationObserver} */
    const newsletterStatusObserver = new MutationObserver(handleNewsletterStatusMutation);
    newsletterStatusObserver.observe(newsletterFormContainer, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true
    });
  }
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
