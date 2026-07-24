import type { FaqItem } from "@/components/faq";

export type CategoryGuide = {
  /** 1:1 with Category.slug — unlike buyers-guides.ts, every category gets one, not tag-gated. */
  slug: string;
  eyebrow: string;
  title: string;
  intro: string;
  /** Decision-level "check this first" points — not spec definitions (see spec-glossary.ts for those). */
  whatMattersMost: { point: string; why: string }[];
  budgetTiers: { label: string; description: string }[];
  commonMistakes: string[];
  /** Feeds <Faq items={guide.faqs}/> directly, which emits its own FAQPage JSON-LD. */
  faqs: FaqItem[];
};

export const categoryGuides: CategoryGuide[] = [
  {
    slug: "phones",
    eyebrow: "Buyer's Guide",
    title: "How to choose the right phone",
    intro:
      "Ten phones at the same price point can differ more in the fine print than the spec sheet. Here's what actually matters before you buy.",
    whatMattersMost: [
      {
        point: "Where the stock comes from",
        why: "East Africa-sourced units are backed by a local service center for repairs; imported stock (commonly Dubai, but not exclusively) is brand new and factory sealed but isn't tied to that local center. Check which one you're buying before deciding on warranty length alone.",
      },
      {
        point: "SIM and eSIM support",
        why: "Not every unit supports eSIM the same way — some imported phones, especially mainland-China-spec iPhones, ship with two physical SIM slots and no eSIM at all. If eSIM matters to you, confirm the specific unit supports it first.",
      },
      {
        point: "Processor and RAM for how you'll actually use it",
        why: "Calls, browsing, and basic apps run fine on a mid-tier chip with 4-6GB of RAM — the top-tier processor mostly pays off for gaming and heavy multitasking.",
      },
      {
        point: "Storage you can't add later",
        why: "Most phones can't be expanded with a memory card, so buy the storage tier you'll actually need for photos and apps rather than the cheapest option.",
      },
      {
        point: "Battery capacity vs. screen size",
        why: "A bigger battery number doesn't guarantee longer battery life if it's also driving a larger, higher-refresh-rate display.",
      },
    ],
    budgetTiers: [
      {
        label: "Entry",
        description: "A reliable daily driver for calls, messaging, browsing, and social media — Redmi/Xiaomi and Galaxy A series cover this well.",
      },
      {
        label: "Mid",
        description: "A faster chip, better camera, and sharper display for gaming and heavier multitasking — Galaxy S series, Pixel, OnePlus, Nothing.",
      },
      {
        label: "Premium",
        description: "Flagship processors, best-in-class camera systems, and the longest software-update commitments — iPhone 17 series, Galaxy S26, folding phones.",
      },
    ],
    commonMistakes: [
      "Buying imported stock without asking about SIM configuration first, then finding out eSIM isn't supported.",
      "Maxing out RAM/storage budget for light use that would run fine on a mid-tier phone.",
      "Assuming any charger fits — fast-charging speed depends on the charger's output wattage matching the phone.",
    ],
    faqs: [
      {
        q: "Does this phone support eSIM?",
        a: "Check the specific listing — most current iPhone and Android flagships support eSIM, but some imported units (especially China-spec models) don't. Message us on WhatsApp before ordering if eSIM matters to you.",
      },
      {
        q: "What's the difference between East Africa and imported stock?",
        a: "East Africa-sourced units are backed by a local service center for repairs. Imported units (commonly Dubai, but not exclusively) are brand new and factory sealed, but repairs aren't tied to that local center — check the stock-option table on any listing with more than one option for the specifics.",
      },
      {
        q: "How much storage do I actually need?",
        a: "128GB is comfortable for most people; go to 256GB or more if you shoot a lot of photos and video or rarely delete apps — storage can't be expanded after purchase on most phones.",
      },
    ],
  },
  {
    slug: "tablets",
    eyebrow: "Buyer's Guide",
    title: "How to choose the right tablet",
    intro: "A tablet's real cost is the ecosystem you commit to — here's what to weigh before you pick one.",
    whatMattersMost: [
      {
        point: "Stylus and keyboard lock-in",
        why: "A Galaxy Tab's S Pen, a Surface's Type Cover, and an iPad's Apple Pencil don't cross over to other brands — the accessory ecosystem you buy into is as permanent as the tablet itself.",
      },
      {
        point: "What you'll actually use it for",
        why: "An e-reader is built for distraction-free reading with weeks of battery life; a general tablet is built for apps, video, and multitasking — using one for the other's job is where most disappointment comes from.",
      },
      {
        point: "Operating system, not just specs",
        why: "Android tablets, iPadOS, and Fire OS have very different app libraries — check that the specific apps you need exist on that platform before comparing screen size or chip speed.",
      },
      {
        point: "Storage and RAM for multitasking",
        why: "If you plan to run split-screen apps or a stylus note-taking app alongside a browser, more RAM matters here more than it does on a phone.",
      },
    ],
    budgetTiers: [
      { label: "Entry", description: "Browsing, video, e-books, and light note-taking — Fire tablets, entry Galaxy Tab, e-readers." },
      { label: "Mid", description: "Comfortable for work and study with a keyboard case — mid Galaxy Tab, entry iPad." },
      { label: "Premium", description: "Laptop-replacement territory with stylus support — iPad Pro, Surface, top-tier Galaxy Tab." },
    ],
    commonMistakes: [
      "Buying a tablet and its stylus or keyboard separately from different generations that turn out incompatible.",
      "Choosing by screen size alone and skipping whether the apps you need actually run well on that OS.",
      "Picking an e-reader for general tablet use, or the reverse, then being unhappy with the tradeoff.",
    ],
    faqs: [
      {
        q: "Will my phone charger work with this tablet?",
        a: "Most current tablets charge over USB-C, but check the charger's output wattage — a tablet's larger battery usually charges slower on a phone-rated charger.",
      },
      {
        q: "Can I use one brand's stylus with another brand's tablet?",
        a: "No — Apple Pencil, S Pen, and Surface Pen are each built for their own tablet's digitizer and don't work across brands.",
      },
      {
        q: "Is an e-reader just a smaller tablet?",
        a: "No — e-readers use e-ink displays built for weeks of battery life and comfortable reading, but they don't run general apps the way a tablet does.",
      },
    ],
  },
  {
    slug: "computers",
    eyebrow: "Buyer's Guide",
    title: "How to choose a laptop or desktop",
    intro: "The same specs mean something different depending on what you're actually doing on the machine — here's how to read past the spec sheet.",
    whatMattersMost: [
      {
        point: "Processor and RAM for your actual workload",
        why: "A faster processor with more cores pays off for heavier multitasking, gaming, and editing — light use like browsing and documents runs fine without the top tier.",
      },
      {
        point: "Storage you can't always upgrade",
        why: "Some laptops solder storage to the board — check whether it's user-upgradeable before assuming you can add space later.",
      },
      {
        point: "Display quality over size",
        why: "A sharper panel matters more for daily comfort than raw screen size, especially if you're looking at it for hours at a time.",
      },
      {
        point: "Port selection for your desk setup",
        why: "If you're relying on a dock or hub for extra ports, check the laptop's own ports — and the dock's compatibility — before assuming everything just plugs in.",
      },
      {
        point: "Ecosystem: Mac vs. Windows/Surface",
        why: "Software, accessory compatibility, and how it pairs with your phone all follow from this choice more than any single spec does.",
      },
    ],
    budgetTiers: [
      { label: "Entry", description: "Browsing, documents, video calls, and streaming — entry laptops and Chromebook-class machines." },
      { label: "Mid", description: "Comfortable multitasking, photo editing, and moderate gaming — mid-tier Mac, Surface, and Windows laptops." },
      { label: "Premium", description: "Video editing, heavy multitasking, and demanding creative work — top-tier Mac, Surface, and gaming-capable laptops." },
    ],
    commonMistakes: [
      "Buying a laptop stand or dock before checking it's actually compatible with the laptop's ports and weight.",
      "Choosing storage size based on price instead of what you'll actually fill it with over the machine's lifetime.",
      "Assuming a monitor will run at full resolution and refresh rate off any dock — check the dock's own specs, not just the monitor's.",
    ],
    faqs: [
      {
        q: "Do I need a dock or hub for this laptop?",
        a: "Depends on how many ports it has natively and what you plan to plug in — check the laptop's port list against what you need before assuming you'll need an add-on.",
      },
      {
        q: "Is more RAM always worth paying for?",
        a: "Only if you actually multitask heavily or run demanding apps — for browsing and documents, the base RAM tier is usually enough.",
      },
      {
        q: "Can I put a laptop stand under any laptop?",
        a: "Most clamp/stand designs fit a wide size range, but check the stand's weight limit against your laptop, especially for larger 16-17\" models.",
      },
    ],
  },
  {
    slug: "audio",
    eyebrow: "Buyer's Guide",
    title: "How to choose headphones, earbuds, or speakers",
    intro: "The right pick depends more on how you'll use it — calls, workouts, critical listening — than on the spec sheet alone.",
    whatMattersMost: [
      {
        point: "Driver size isn't the whole story",
        why: "Larger drivers often (not always) produce fuller bass, but tuning matters more than size alone — don't pick by driver size by itself.",
      },
      {
        point: "Frequency response for your kind of listening",
        why: "A wider frequency range generally means more detail at both ends — matters more for music production or critical listening than for calls or casual use.",
      },
      {
        point: "Open-ear vs. sealed for your use case",
        why: "Sealed earbuds isolate noise for commuting and calls; open-ear designs like Shokz trade isolation for situational awareness on runs and workouts.",
      },
      {
        point: "Whether it's built for gaming, not just listening",
        why: "Gaming audio gear prioritizes positional accuracy and low-latency wireless over pure sound quality — a good pair of music headphones isn't always a good gaming headset.",
      },
    ],
    budgetTiers: [
      { label: "Entry", description: "Solid everyday sound for calls and casual listening — entry earbuds and headphones." },
      { label: "Mid", description: "Noticeably better tuning, noise cancellation, and battery life — JBL, Shokz, mid-tier Bose." },
      { label: "Premium", description: "Critical-listening quality and best-in-class noise cancellation — Bose, high-end studio mics like Rode, premium speakers." },
    ],
    commonMistakes: [
      "Buying noise-cancelling earbuds for running when open-ear would be safer and more comfortable.",
      "Picking a microphone by price instead of checking its polar pattern matches the recording setup.",
      "Assuming all Bluetooth earbuds work equally well for gaming — check for a dedicated low-latency mode if that's the main use.",
    ],
    faqs: [
      {
        q: "What's the difference between a cardioid and omnidirectional microphone?",
        a: "Cardioid mics focus on what's directly in front of them — good for solo voice or interviews. Omnidirectional mics pick up sound evenly from all directions — better for group or room recording.",
      },
      {
        q: "Do open-ear headphones work well for calls?",
        a: "Yes, though background noise comes through more than with sealed earbuds — a reasonable tradeoff for safety and comfort during runs and workouts.",
      },
      {
        q: "Will any gaming headset work with my console and PC?",
        a: "Check the connection type — some gaming audio gear uses a proprietary USB dongle that only works with specific consoles or PCs, not a universal Bluetooth connection.",
      },
    ],
  },
  {
    slug: "wearables",
    eyebrow: "Buyer's Guide",
    title: "How to choose a smartwatch or fitness tracker",
    intro: "The phone in your pocket decides more about which wearable you can buy than any feature on the watch itself.",
    whatMattersMost: [
      {
        point: "Phone-ecosystem lock-in is the real decision",
        why: "Apple Watch needs an iPhone to set up and function fully; Galaxy Watch pairs best with a Galaxy phone. Buying across ecosystems means losing features, not just app icons.",
      },
      {
        point: "Smartwatch vs. dedicated fitness tracker",
        why: "A smartwatch trades battery life for notifications and apps; a dedicated tracker like Whoop trades those away for multi-day battery and sharper recovery and performance data.",
      },
      {
        point: "Water resistance rating for your activities",
        why: "Higher IP ratings tolerate more exposure, but check the specific rating against what you actually do — swimming needs a higher rating than sweat resistance for the gym.",
      },
      {
        point: "Smart glasses are a different category entirely",
        why: "Ray-Ban Meta-style smart glasses add a camera and AI assistant to a frame you'd wear anyway — they solve a different problem (hands-free capture), not a smartwatch replacement.",
      },
    ],
    budgetTiers: [
      { label: "Entry", description: "Notifications, basic activity tracking, and multi-day battery — entry fitness bands." },
      { label: "Mid", description: "Full smartwatch features with a day or two of battery — Galaxy Watch, Apple Watch." },
      { label: "Premium", description: "Advanced health sensors and recovery tracking, or premium smart glasses — Whoop, top-tier Apple/Galaxy Watch, Ray-Ban Meta." },
    ],
    commonMistakes: [
      "Buying an Apple Watch with an Android phone (or the reverse) and losing most of its features.",
      "Choosing a smartwatch expecting multi-day battery life that only a dedicated tracker actually delivers.",
      "Assuming a splash-resistant rating covers swimming — check the specific IP rating, not just \"water resistant.\"",
    ],
    faqs: [
      {
        q: "Can I use an Apple Watch with an Android phone?",
        a: "No — Apple Watch requires an iPhone to pair and set up; it won't function as a standalone smartwatch with Android.",
      },
      {
        q: "What's the difference between a smartwatch and a fitness tracker like Whoop?",
        a: "A smartwatch runs apps and shows notifications on a display; a dedicated tracker like Whoop skips the screen in favor of longer battery life and deeper recovery and strain metrics.",
      },
      {
        q: "Do smart glasses replace my smartwatch?",
        a: "No — they solve a different problem (hands-free photo, video, and voice assistant access), not notifications or fitness tracking on your wrist.",
      },
    ],
  },
  {
    slug: "chargers",
    eyebrow: "Buyer's Guide",
    title: "How to choose a charger, power bank, or cable",
    intro: "The number on the box only matters if it matches your device — here's the decision logic behind output power and capacity.",
    whatMattersMost: [
      {
        point: "Match wattage to your device's fast-charging spec",
        why: "A charger's output power only charges at full speed if it meets or exceeds what your specific device is rated to accept — a higher-wattage charger won't overcharge it, but a lower one will just charge slower.",
      },
      {
        point: "USB-C PD vs. proprietary fast charging",
        why: "Universal USB-C Power Delivery works across most modern devices; some phone brands also support their own faster proprietary protocol that needs a matching charger and cable to actually hit top speed.",
      },
      {
        point: "Cable certification is the hidden bottleneck",
        why: "An uncertified or underrated cable bottlenecks a fast charger's output regardless of how capable the charger itself is — the cable has to support the wattage too, not just the plug.",
      },
      {
        point: "Power bank capacity vs. real-world charges",
        why: "A power bank's rated capacity is higher than what actually reaches your device due to conversion loss — expect roughly 60-80% of the rated capacity in practice.",
      },
    ],
    budgetTiers: [
      { label: "Entry", description: "Everyday charging for phones and small devices — standard wall chargers and basic cables." },
      { label: "Mid", description: "Faster charging and multi-device power banks — Anker and Baseus fast chargers, mid-capacity power banks." },
      { label: "Premium", description: "High-wattage chargers that cover laptops and phones together, and large-capacity power banks for travel — flagship Anker and Baseus gear." },
    ],
    commonMistakes: [
      "Buying a high-wattage charger but pairing it with a cheap cable that can't carry the full power.",
      "Assuming a power bank's rated mAh is what you'll actually get out of it — real-world output is meaningfully lower.",
      "Charging a laptop with a phone-rated charger and wondering why it charges slowly or not at all.",
    ],
    faqs: [
      {
        q: "Will a higher-wattage charger damage my phone?",
        a: "No — devices only draw the power they're rated for, regardless of the charger's maximum output. A higher-wattage charger just means it can also fast-charge larger devices.",
      },
      {
        q: "Why isn't my power bank fully charging my phone?",
        a: "Some capacity is lost to heat and voltage conversion — expect a power bank to deliver roughly 60-80% of its rated capacity in actual charges.",
      },
      {
        q: "Do I need a special cable for fast charging?",
        a: "Yes, if you want to hit the charger's full rated speed — an underrated or uncertified cable will bottleneck output even from a capable charger.",
      },
    ],
  },
  {
    slug: "gaming",
    eyebrow: "Buyer's Guide",
    title: "How to choose a console, controller, or gaming gear",
    intro: "The console decision usually comes down to which games and friends you're playing with — everything else is picking gear to match.",
    whatMattersMost: [
      {
        point: "Console family and exclusives, not raw specs",
        why: "Which games and friends you play with usually decides the console choice before any performance spec does — check exclusives and cross-play support for your group first.",
      },
      {
        point: "Peripherals built for competitive play vs. casual use",
        why: "Gaming-grade peripherals like Razer's lineup, the largest share of this catalog, prioritize response time and precision — a big upgrade for competitive play, a smaller one for casual gaming.",
      },
      {
        point: "Headset vs. standalone microphone",
        why: "A gaming headset bundles audio and mic into one — a standalone mic usually sounds better for voice if you're streaming or recording, at the cost of convenience.",
      },
      {
        point: "Storage fills up fast",
        why: "Modern game installs are large — check a console's usable storage against how many games you actually plan to keep installed at once, not just the number on the box.",
      },
      {
        point: "Disc platform and condition",
        why: "A physical disc only works on the platform it was sold for, and a Used Disc costs less but may not include unredeemed digital extras or online passes — check both before buying secondhand or switching consoles.",
      },
    ],
    budgetTiers: [
      { label: "Entry", description: "Handheld or budget console gaming with basic controllers — portable consoles, entry peripherals." },
      { label: "Mid", description: "A current-gen console plus a solid peripheral upgrade — mainstream consoles, Razer mid-tier gear." },
      { label: "Premium", description: "A top-tier console setup with competitive-grade peripherals — flagship consoles, premium Razer peripherals and gaming audio." },
    ],
    commonMistakes: [
      "Buying a console for its exclusives without checking whether the friends you play with are on the same platform.",
      "Upgrading peripherals before checking whether storage is the actual bottleneck for a growing game library.",
      "Choosing a gaming headset for streaming or recording when a standalone mic would sound noticeably better.",
      "Buying a Used Disc expecting the same digital bonus content or online pass as a New Disc — check what's actually included first.",
    ],
    faqs: [
      {
        q: "Do I need gaming-specific peripherals, or will any controller or headset work?",
        a: "Any compatible peripheral works, but gaming-specific gear is tuned for faster response time and precision — worth it for competitive play, optional for casual gaming.",
      },
      {
        q: "Can I play with friends on a different console?",
        a: "Depends on the specific game's cross-play support — check that before assuming any two consoles can play together.",
      },
      {
        q: "Is a gaming headset good enough for streaming?",
        a: "It's convenient, but a standalone microphone usually sounds noticeably better for voice if streaming or recording quality matters to you — see the Audio category for options.",
      },
      {
        q: "Can I trade in a game I already own?",
        a: "Yes — use the Trade-In option on any game's page to swap it toward a new game, a used game, or cash/store credit.",
      },
    ],
  },
  {
    slug: "cameras",
    eyebrow: "Buyer's Guide",
    title: "How to choose a camera, gimbal, or content-creation setup",
    intro: "Megapixels are the least useful number on a camera spec sheet — here's what actually predicts image quality.",
    whatMattersMost: [
      {
        point: "Sensor size over megapixel count",
        why: "A larger sensor gathers more light, which generally means better low-light shots and more control over depth of field, independent of how many megapixels it's rated for.",
      },
      {
        point: "What you're actually shooting",
        why: "Action and on-the-move footage points toward a gimbal-stabilized or action camera — DJI is the largest single vendor in this catalog for a reason. Posed or studio shooting points toward a traditional camera body instead.",
      },
      {
        point: "Instant vs. digital",
        why: "Instant cameras like Fujifilm and Kodak trade resolution and editing flexibility for a physical print in hand — a different use case from a digital camera you'll edit and share online.",
      },
      {
        point: "Gimbal vs. built-in stabilization",
        why: "A dedicated gimbal, from DJI or Zhiyun, smooths handheld motion far more than a camera or phone's built-in stabilization alone — worth it specifically for moving shots, not static photography.",
      },
    ],
    budgetTiers: [
      { label: "Entry", description: "Point-and-shoot simplicity and instant cameras — Fujifilm and Kodak instant cameras, entry action cameras." },
      { label: "Mid", description: "Real creative control with interchangeable options — mid-tier mirrorless bodies, DJI gimbals and action cameras." },
      { label: "Premium", description: "Full manual control and professional-grade stabilization — Canon bodies and top-tier DJI or Insta360 gear." },
    ],
    commonMistakes: [
      "Choosing a camera by megapixel count alone and overlooking sensor size, which matters more for real-world image quality.",
      "Buying a static camera for action or sports use instead of a gimbal-stabilized or action camera built for movement.",
      "Expecting an instant camera to match a digital camera's editing flexibility — it's a different product for a different moment.",
    ],
    faqs: [
      {
        q: "Do more megapixels mean better photos?",
        a: "Not necessarily — sensor size and lens quality affect image quality, especially in low light, more than megapixel count alone. More megapixels mainly help with cropping and large prints.",
      },
      {
        q: "Do I need a gimbal if my camera already has stabilization?",
        a: "Built-in stabilization helps with small shakes, but a dedicated gimbal smooths much more motion — worth it specifically if you're shooting while walking, running, or riding.",
      },
      {
        q: "What's the point of an instant camera if I have a phone?",
        a: "A physical print in hand, immediately — it's a different experience from a digital photo you'd edit and share, not a replacement for it.",
      },
    ],
  },
  {
    slug: "appliances",
    eyebrow: "Buyer's Guide",
    title: "How to choose a TV, fridge, or home appliance",
    intro: "The upfront price is only part of the cost — here's what to weigh before buying an appliance you'll run for years.",
    whatMattersMost: [
      {
        point: "Energy rating affects the real cost of ownership",
        why: "A higher energy-efficiency rating uses less electricity for the same job — it adds up over the appliance's lifetime and is worth weighing against a lower upfront price.",
      },
      {
        point: "Size for the space you actually have",
        why: "Check dimensions against your actual space, and doorways for delivery, before buying — appliances aren't easily returned once installed.",
      },
      {
        point: "Brand catalog depth for parts and accessories",
        why: "Vision Plus is the largest single vendor in this category — established brands with more units in the market generally make replacement parts easier to find later.",
      },
      {
        point: "TVs, sound bars, and streaming devices are separate decisions",
        why: "A TV's built-in speakers are rarely as good as a dedicated sound bar, and a streaming device is worth adding to any TV that doesn't already have the smart-TV app you need.",
      },
    ],
    budgetTiers: [
      { label: "Entry", description: "Reliable basics for everyday use — entry TVs, fans, and kitchen appliances." },
      { label: "Mid", description: "Better energy ratings and larger capacities — mid-tier fridges, washers, and TVs from Vision Plus, Hisense, TCL." },
      { label: "Premium", description: "Largest capacities, best energy ratings, and premium picture or sound — flagship TVs and appliances." },
    ],
    commonMistakes: [
      "Buying on upfront price alone and ignoring the energy rating, which affects running cost for years.",
      "Not measuring doorways and delivery paths before buying a large fridge or washing machine.",
      "Expecting a TV's built-in speakers to sound as good as a dedicated sound bar.",
    ],
    faqs: [
      {
        q: "Is a higher energy rating worth paying more for?",
        a: "Usually yes for appliances you'll run daily for years, like fridges and washing machines — the running-cost savings add up and often outweigh a higher upfront price over the appliance's lifetime.",
      },
      {
        q: "Do I need a sound bar if my TV already has speakers?",
        a: "Most built-in TV speakers are a noticeable step down from even an entry-level sound bar — worth adding if sound quality matters to you.",
      },
      {
        q: "How do I know an appliance will fit my space?",
        a: "Check the listed dimensions against your space and doorway width before ordering — message us on WhatsApp if you're unsure about delivery for a large item.",
      },
    ],
  },
  {
    slug: "accessories",
    eyebrow: "Buyer's Guide",
    title: "How to choose accessories that actually fit",
    intro: "This is the broadest category we stock — the right pick almost always comes down to compatibility with a specific device, not the accessory alone.",
    whatMattersMost: [
      {
        point: "Compatibility with your exact device or model",
        why: "Cases, screen protectors, and mounts are usually built for a specific phone or device model — check the exact match before buying, not just the brand.",
      },
      {
        point: "Car accessories need to match your vehicle, not just your phone",
        why: "Mounts and chargers built for the car need to fit your specific dash or vent setup and your device, not just one or the other.",
      },
      {
        point: "Bundles can be cheaper than buying piece by piece",
        why: "If you're setting up a new phone or car, a kit — like the Car Essentials or Accessories Starter Kit — often covers the same essentials for less than buying each item separately.",
      },
    ],
    budgetTiers: [
      { label: "Entry", description: "Basic cases, cables, and screen protection for everyday use." },
      { label: "Mid", description: "Car mounts, multi-device accessories, and better-material cases." },
      { label: "Premium", description: "Premium materials and multi-accessory bundles for a full setup." },
    ],
    commonMistakes: [
      "Buying a case or screen protector by brand alone without checking it matches your exact phone model.",
      "Buying accessories one at a time when a kit would cover the same setup for less.",
      "Assuming any car mount fits any vent or dash — check the mount's fit against your specific car.",
    ],
    faqs: [
      {
        q: "How do I know a case or accessory fits my phone?",
        a: "Check the exact model listed on the product page — cases and screen protectors are molded to a specific phone's dimensions and camera layout, not a universal fit.",
      },
      {
        q: "Is it cheaper to buy a kit instead of individual accessories?",
        a: "Often yes if you need most of what's in it — check the Car Essentials or Accessories Starter Kit pages for bundled pricing on the essentials most new devices need.",
      },
      {
        q: "Do I need different accessories for different phone generations?",
        a: "Usually yes — even within the same phone line, camera layouts and dimensions can change between generations, so check the exact model match.",
      },
    ],
  },
];

export function getCategoryGuide(slug: string): CategoryGuide | undefined {
  return categoryGuides.find((g) => g.slug === slug);
}
