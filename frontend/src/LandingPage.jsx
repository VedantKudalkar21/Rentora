import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  ArrowRight,
  Camera,
  Wrench,
  Tent,
  Monitor,
  Speaker,
  CalendarDays,
  ScanEye,
  ClipboardCheck,
  Check,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { EquipmentCard } from "./CataloguePage";
import { ProductImage } from "./ProductPhotos";
import EquipmentArt from "./EquipmentArt";
import { money } from "./uiHelpers";

const categories = [
  { name: "Cameras", icon: Camera, line: "Make something worth keeping." },
  { name: "Tools", icon: Wrench, line: "For the projects on your list." },
  { name: "Outdoor", icon: Tent, line: "Take the weekend outside." },
  { name: "Electronics", icon: Monitor, line: "Plug into your next idea." },
  { name: "Events", icon: Speaker, line: "Bring people together." },
];
function GearVisual({ item, category }) {
  return item?.photos?.length ? (
    <ProductImage
      photo={item.photos[0]}
      alt={item.name}
      className="landing-gear-image"
    />
  ) : (
    <EquipmentArt category={category} />
  );
}
export default function LandingPage({ equipment, onView, user }) {
  const reduced = useReducedMotion();
  const camera = equipment.find(
    (item) => item.category === "Cameras" && item.active,
  );
  const outdoor = equipment.find(
    (item) => item.category === "Outdoor" && item.active,
  );
  const tools = equipment.find(
    (item) => item.category === "Tools" && item.active,
  );
  const featured = equipment.filter((item) => item.active).slice(0, 3);
  const reveal = {
    initial: { opacity: 0, y: 22 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-35px" },
    transition: { duration: 0.5 },
  };
  return (
    <>
      <section className="landing-hero page-container">
        <motion.div
          className="landing-hero-copy"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="hero-kicker">
            <span />
            GOOD GEAR. ZERO FULL-TIME COMMITMENT.
          </span>
          <h1>
            Make more.
            <br />
            <em>Own less.</em>
            <span className="hero-title-dot">✳</span>
          </h1>
          <p>
            The right equipment for your next project,
            <br className="desktop-break" /> weekend, or whatever comes next.
          </p>
          <div className="hero-actions">
            <Button asChild size="lg">
              <Link to="/explore">
                Explore equipment
                <ArrowUpRight size={19} />
              </Link>
            </Button>
            <Link
              className="hero-secondary-link"
              to={user?.role === "ADMIN" ? "/admin/equipment" : "/my-listings"}
            >
              List your gear
              <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hero-benefits">
            <span>
              <Check size={15} />
              Flexible dates
            </span>
            <span>
              <Check size={15} />
              Clear daily pricing
            </span>
            <span>
              <Check size={15} />
              Real product photos
            </span>
          </div>
        </motion.div>
        <div className="landing-hero-scene">
          <div className="scene-orbit orbit-outer" />
          <div className="scene-orbit orbit-inner" />
          <motion.div
            className="hero-main-card"
            initial={{ opacity: 0, rotate: -5, y: 25 }}
            animate={{ opacity: 1, rotate: -5, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="hero-card-top">
              <span>FOR YOUR NEXT BIG IDEA</span>
              <Camera size={17} />
            </div>
            <div className="hero-main-visual">
              <GearVisual item={camera} category="Cameras" />
            </div>
            <div className="hero-card-caption">
              <div>
                <span>CREATE SOMETHING</span>
                <strong>{camera?.name || "Photography essentials"}</strong>
              </div>
              {camera && (
                <span className="hero-card-rate">
                  {money(camera.dailyRate)}
                  <small>/ day</small>
                </span>
              )}
            </div>
          </motion.div>
          <motion.div
            className="hero-small-card outdoor-scene"
            initial={{ opacity: 0, y: 20, rotate: 9 }}
            animate={
              reduced
                ? { opacity: 1, y: 0, rotate: 9 }
                : { opacity: 1, y: [0, -7, 0], rotate: 9 }
            }
            transition={{
              opacity: { duration: 0.4, delay: 0.35 },
              y: { duration: 5, repeat: Infinity, ease: "easeInOut" },
            }}
          >
            <GearVisual item={outdoor} category="Outdoor" />
            <span>
              Take it outside.
              <ArrowUpRight size={18} />
            </span>
          </motion.div>
          <motion.div
            className="hero-small-card tool-scene"
            initial={{ opacity: 0, y: 20, rotate: 5 }}
            animate={{ opacity: 1, y: 0, rotate: 5 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <GearVisual item={tools} category="Tools" />
            <span>
              Make it happen.
              <ArrowUpRight size={18} />
            </span>
          </motion.div>
          <div className="hero-scene-sticker">
            <ArrowUpRight size={22} />
            <span>
              YOURS.
              <br />
              FOR A WHILE.
            </span>
          </div>
          <span className="scene-spark spark-one">✳</span>
          <span className="scene-spark spark-two">+</span>
        </div>
      </section>
      <div className="landing-trust-strip">
        <div className="page-container">
          <span>
            <CalendarDays size={20} />
            <strong>Your dates, your plans.</strong>
          </span>
          <span>
            <ScanEye size={20} />
            <strong>See the condition upfront.</strong>
          </span>
          <span>
            <ClipboardCheck size={20} />
            <strong>Listings reviewed before publishing.</strong>
          </span>
        </div>
      </div>
      <motion.section
        {...reveal}
        className="landing-categories page-container"
        id="categories"
      >
        <div className="section-title-row">
          <div>
            <span className="kicker">WHAT’S ON YOUR AGENDA?</span>
            <h2>A category for every plan.</h2>
          </div>
          <Link to="/explore" className="text-link">
            Explore all
            <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="landing-category-grid">
          {categories.map((category, index) => (
            <Link
              key={category.name}
              className={"landing-category category-tone-" + index}
              to={"/explore?category=" + category.name}
            >
              <div className="category-icon">
                <category.icon size={27} strokeWidth={1.5} />
              </div>
              <div>
                <strong>{category.name}</strong>
                <p>{category.line}</p>
              </div>
              <ArrowUpRight size={20} />
            </Link>
          ))}
        </div>
      </motion.section>
      {featured.length > 0 && (
        <motion.section {...reveal} className="landing-featured page-container">
          <div className="section-title-row">
            <div>
              <span className="kicker">READY WHEN YOU ARE</span>
              <h2>Your next rental starts here.</h2>
            </div>
            <Button asChild variant="outline">
              <Link to="/explore">
                Browse equipment
                <ArrowUpRight size={16} />
              </Link>
            </Button>
          </div>
          <div className="gear-grid">
            {featured.map((item) => (
              <EquipmentCard key={item.id} item={item} onView={onView} />
            ))}
          </div>
        </motion.section>
      )}
      <section className="landing-how" id="how-it-works">
        <div className="page-container">
          <motion.div {...reveal} className="how-heading">
            <span className="kicker">LESS FUSS. MORE DOING.</span>
            <h2>
              From “what if”
              <br />
              to <em>“let’s do it.”</em>
            </h2>
            <p>Three simple steps to your next rental.</p>
          </motion.div>
          <div className="how-steps">
            {[
              {
                n: "01",
                title: "Find your gear.",
                text: "Browse equipment and check its photos, condition, and daily rate.",
              },
              {
                n: "02",
                title: "Pick your dates.",
                text: "Choose when you need it and send a booking request for approval.",
              },
              {
                n: "03",
                title: "Make it happen.",
                text: "Follow your rental status and return the equipment when your rental ends.",
              },
            ].map((step) => (
              <motion.article {...reveal} key={step.n}>
                <span>{step.n}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>
      <motion.section {...reveal} className="landing-lend page-container">
        <div className="lend-banner">
          <div>
            <span className="kicker">GOOD EQUIPMENT SHOULDN’T SIT STILL</span>
            <h2>
              Your gear deserves
              <br />
              more than a shelf.
            </h2>
            <p>List your equipment, add photos, and submit it for review.</p>
            <Button asChild size="lg">
              <Link
                to={
                  user?.role === "ADMIN" ? "/admin/equipment" : "/my-listings"
                }
              >
                List your equipment
                <ArrowUpRight size={18} />
              </Link>
            </Button>
          </div>
          <div className="lend-illustration">
            <EquipmentArt category="Tools" />
            <div className="lend-stamp">
              GIVE YOUR
              <br />
              GEAR A<br />
              <strong>SECOND ACT.</strong>
            </div>
          </div>
        </div>
      </motion.section>
    </>
  );
}
