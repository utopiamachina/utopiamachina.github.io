/** @type {HTMLFormElement | null} */
const newsletterForm = document.querySelector("[data-newsletter-form]");

if (newsletterForm) {
  /** @type {HTMLInputElement | null} */
  const emailInput = newsletterForm.querySelector('input[name="EMAIL"]');
  /** @type {HTMLElement | null} */
  const newsletterDetails = newsletterForm.querySelector("[data-newsletter-details]");
  /** @type {HTMLButtonElement | null} */
  const newsletterButton = newsletterForm.querySelector('button[type="submit"]');

  /** @type {() => void} */
  const expandNewsletter = () => {
    if (!newsletterDetails || newsletterForm.classList.contains("is-expanded")) {
      return;
    }

    newsletterForm.classList.add("is-expanded");
    newsletterDetails.setAttribute("aria-hidden", "false");
    newsletterButton?.setAttribute("aria-expanded", "true");
  };

  emailInput?.addEventListener("input", () => {
    if (emailInput.value.trim()) {
      expandNewsletter();
    }
  });

  newsletterButton?.addEventListener("click", (event) => {
    if (!newsletterForm.classList.contains("is-expanded")) {
      event.preventDefault();
      expandNewsletter();
      if (emailInput?.value.trim()) {
        newsletterDetails?.querySelector("input")?.focus();
      } else {
        emailInput?.focus();
      }
    }
  });

  newsletterForm.addEventListener(
    "submit",
    (event) => {
      if (!newsletterForm.classList.contains("is-expanded")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        expandNewsletter();
        newsletterDetails?.querySelector("input")?.focus();
      }
    },
    true
  );
}

/** @param {string} _token */
window.handleCaptchaResponse = (_token) => {
  /** @type {HTMLElement | null} */
  const captcha = document.getElementById("sib-captcha");

  captcha?.dispatchEvent(new Event("captchaChange"));
  window.grecaptcha = window.turnstile;
};

document.querySelectorAll("[data-year]").forEach((item) => {
  item.textContent = new Date().getFullYear();
});
