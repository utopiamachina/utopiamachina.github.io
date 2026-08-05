const newsletterForm = document.querySelector("[data-newsletter-form]");

if (newsletterForm) {
  newsletterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const status = newsletterForm.querySelector("[data-form-status]");
    const interests = newsletterForm.querySelectorAll('input[name="interests"]');

    if (!interests.length) {
      status.textContent = "Choose at least one signal first.";
      return;
    }

    status.textContent = "Almost there — the mailing-list connection is the final step.";
  });
}

document.querySelectorAll("[data-year]").forEach((item) => {
  item.textContent = new Date().getFullYear();
});
