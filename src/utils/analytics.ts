import ReactGA from "react-ga4";

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

/**
 * Initialize GA4
 */
export const initGA = () => {
  if (GA_MEASUREMENT_ID) {
    ReactGA.initialize(GA_MEASUREMENT_ID);
    console.log("GA4 Initialized with ID:", GA_MEASUREMENT_ID);
  } else {
    console.warn("GA4 Measurement ID not found. Analytics will not be initialized.");
  }
};

/**
 * Track a custom event
 * @param {Object} event - The event data
 * @param {string} event.category - The category of the event (e.g., 'Conversion')
 * @param {string} event.action - The action performed (e.g., 'Click')
 * @param {string} event.label - The label for the event (e.g., 'Start Free Trial')
 * @param {number} [event.value] - Optional numeric value
 */
export const trackEvent = ({ category, action, label, value }: { 
  category: string; 
  action: string; 
  label: string; 
  value?: number; 
}) => {
  ReactGA.event({
    category,
    action,
    label,
    value,
  });
};

/**
 * Track a pageview
 * @param {string} path - The path of the page
 */
export const trackPageView = (path: string) => {
  ReactGA.send({ hitType: "pageview", page: path });
};
