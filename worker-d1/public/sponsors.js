const ROTATION_FALLBACK_MS = 15_000;
const UMAMI_EVENTS = {
  sponsorClicked: "Sponsor clicked",
  offerOpened: "Sponsor offer opened",
  checkoutClicked: "Sponsor checkout clicked",
};
const EXAMPLE_SPONSOR = {
  name: "OpenCode Go",
  tagline: "$5/month coding plan for any agent.",
  logo_url: "/opencode-go.svg",
  href: "https://opencode.ai/go?ref=0PVQ21JT9X",
};

function randomIndex(max) {
  if (max <= 1) return 0;
  if (globalThis.crypto?.getRandomValues) {
    const value = crypto.getRandomValues(new Uint32Array(1))[0];
    return value % max;
  }
  return Math.floor(Math.random() * max);
}

function shuffled(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = randomIndex(index + 1);
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function createSponsorCard(sponsor, compact = false) {
  const link = document.createElement("a");
  link.className = `sponsor-card${compact ? " sponsor-card--compact" : ""}`;
  link.href = sponsor.href;
  link.target = "_blank";
  link.rel = "sponsored noopener noreferrer";
  link.dataset.umamiEvent = UMAMI_EVENTS.sponsorClicked;
  link.dataset.umamiEventSponsor = sponsor.name;
  link.dataset.umamiEventPlacement = compact ? "compact" : "standard";

  const label = document.createElement("span");
  label.className = "sponsor-label";
  label.textContent = "Sponsor";
  link.append(label);

  const logo = document.createElement("span");
  logo.className = "sponsor-logo";
  const fallbackLogoText = initials(sponsor.name);
  logo.textContent = fallbackLogoText;
  if (sponsor.logo_url) {
    const image = document.createElement("img");
    image.src = sponsor.logo_url;
    image.alt = "";
    image.width = 36;
    image.height = 36;
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    logo.replaceChildren(image);
    image.addEventListener("error", () => {
      logo.textContent = fallbackLogoText;
    }, { once: true });
  }
  link.append(logo);

  const copy = document.createElement("span");
  copy.className = "sponsor-copy";
  const name = document.createElement("strong");
  name.textContent = sponsor.name;
  const tagline = document.createElement("span");
  tagline.textContent = sponsor.tagline;
  copy.append(name, tagline);
  link.append(copy);

  return link;
}

function createAdvertiseCard(openOffer, compact = false) {
  const link = document.createElement("button");
  link.type = "button";
  link.className = `sponsor-card sponsor-card--advertise${compact ? " sponsor-card--compact" : ""}`;
  link.dataset.umamiEvent = UMAMI_EVENTS.offerOpened;
  link.dataset.umamiEventPlacement = compact ? "compact" : "standard";
  link.addEventListener("click", openOffer);

  const label = document.createElement("span");
  label.className = "sponsor-label";
  label.textContent = "Sponsor";
  const mark = document.createElement("span");
  mark.className = "sponsor-advertise-mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = "+";
  const copy = document.createElement("span");
  copy.className = "sponsor-copy";
  const title = document.createElement("strong");
  title.textContent = "Advertise here";
  const detail = document.createElement("span");
  detail.textContent = "Reach people building with Codex.";
  copy.append(title, detail);
  link.append(label, mark, copy);
  return link;
}

function showDialog(dialog) {
  if (!dialog.open) dialog.showModal();
}

function updateOffer(dialog, result) {
  const visits = Number(result.monthly_visits);
  const price = Number(result.monthly_price_usd);
  const available = Number(result.available);
  const total = Number(result.total);
  if (Number.isFinite(visits)) {
    dialog.querySelector('[data-role="sponsor-monthly-visits"]').textContent = `~${visits.toLocaleString("en-US")}`;
  }
  if (Number.isFinite(price)) {
    dialog.querySelector('[data-role="sponsor-monthly-price"]').textContent = `$${price}`;
  }
  if (Number.isFinite(available)) {
    dialog.querySelector('[data-role="sponsor-available"]').textContent = String(available);
  }
  if (Number.isFinite(total)) {
    dialog.querySelector('[data-role="sponsor-total"]').textContent = String(total);
  }

  const pay = dialog.querySelector('[data-role="sponsor-pay"]');
  const status = dialog.querySelector('[data-role="sponsor-offer-status"]');
  if (Number.isFinite(price)) {
    pay.dataset.umamiEventPrice = String(price);
  }
  const soldOut = available === 0;
  pay.disabled = !result.checkout_enabled || soldOut;
  pay.textContent = soldOut ? "Sold out" : "Pay with Stripe";
  status.textContent = soldOut
    ? "All ad spots are currently taken."
    : result.checkout_enabled
      ? "Add your ad details after payment."
      : "Checkout is temporarily unavailable.";
}

function wireDialog(dialog) {
  const close = dialog.querySelector('[data-role="sponsor-dialog-close"]');
  const pay = dialog.querySelector('[data-role="sponsor-pay"]');
  const offerStatus = dialog.querySelector('[data-role="sponsor-offer-status"]');
  pay.dataset.umamiEvent = UMAMI_EVENTS.checkoutClicked;

  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  pay.addEventListener("click", async () => {
    pay.disabled = true;
    offerStatus.textContent = "Opening Stripe checkout…";
    try {
      const response = await fetch("/api/sponsors/checkout", {
        method: "POST",
        headers: { accept: "application/json" },
      });
      const result = await response.json();
      if (!response.ok || typeof result.url !== "string") {
        throw new Error(result.error || "Checkout could not be opened.");
      }
      window.location.assign(result.url);
    } catch (error) {
      offerStatus.textContent = error instanceof Error ? error.message : "Checkout could not be opened.";
      pay.disabled = false;
    }
  });

}

function replacePlacement(placement, card) {
  placement.replaceChildren(card);
  placement.hidden = false;
}

export async function enhanceSponsors(root = document) {
  const left = root.querySelector('[data-role="sponsor-left"]');
  const right = root.querySelector('[data-role="sponsor-right"]');
  const mobile = root.querySelector('[data-role="sponsor-mobile"]');
  const dialog = root.querySelector('[data-role="sponsor-dialog"]');
  if ((!left && !right && !mobile) || !dialog) return;

  wireDialog(dialog);
  const openOffer = () => {
    showDialog(dialog);
  };

  if (left) replacePlacement(left, createSponsorCard(EXAMPLE_SPONSOR));

  let sponsors = [];
  let rotationMs = ROTATION_FALLBACK_MS;
  try {
    const response = await fetch("/api/sponsors", { headers: { accept: "application/json" } });
    if (response.ok) {
      const result = await response.json();
      sponsors = Array.isArray(result.sponsors) ? shuffled(result.sponsors) : [];
      updateOffer(dialog, result);
      if (Number.isFinite(result.rotation_ms) && result.rotation_ms >= 5_000) {
        rotationMs = result.rotation_ms;
      }
    }
  } catch {
    // The purchase entry remains useful while sponsor data is unavailable.
  }

  if (sponsors.length === 0) {
    if (right) replacePlacement(right, createAdvertiseCard(openOffer));
    if (mobile) replacePlacement(mobile, createSponsorCard(EXAMPLE_SPONSOR, true));
  } else {
    let offset = 0;
    const render = () => {
      const first = sponsors[offset % sponsors.length];

      if (right) {
        right.replaceChildren(createAdvertiseCard(openOffer, true), createSponsorCard(first));
        right.hidden = false;
      }
      if (mobile) replacePlacement(mobile, createSponsorCard(first, true));
    };

    render();
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (sponsors.length > 1 && !reduceMotion) {
      window.setInterval(() => {
        offset = (offset + 1) % sponsors.length;
        render();
      }, rotationMs);
    }
  }
}
