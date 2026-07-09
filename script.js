/* Year in footer */
document.getElementById("year").textContent = new Date().getFullYear();

/* Mobile nav */
const toggle = document.getElementById("navToggle");
const links = document.getElementById("navLinks");

if (toggle && links) {
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  links.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => {
      links.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

/* Subtle header elevation on scroll */
const header = document.querySelector(".site-header");
if (header) {
  const onScroll = () => {
    header.style.boxShadow =
      window.scrollY > 8 ? "0 8px 30px rgba(0,0,0,0.25)" : "none";
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}
