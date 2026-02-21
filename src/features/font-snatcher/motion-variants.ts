import type { Variants } from "motion/react";

// ─── Shared spring config ───

export const spring = { type: "spring" as const, stiffness: 400, damping: 30 };
export const gentleSpring = { type: "spring" as const, stiffness: 200, damping: 25 };

// ─── Motion variants ───

export const heroStagger: Variants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: { staggerChildren: 0.1, delayChildren: 0.1 },
	},
	exit: {
		opacity: 0,
		transition: { staggerChildren: 0.05, staggerDirection: -1 },
	},
};

export const fadeUp: Variants = {
	hidden: { opacity: 0, y: 24 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.6, ease: [0.23, 1, 0.32, 1] },
	},
	exit: {
		opacity: 0,
		y: -12,
		transition: { duration: 0.3, ease: [0.55, 0, 1, 0.45] },
	},
};

export const cardGrid: Variants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: { staggerChildren: 0.07, delayChildren: 0.1 },
	},
};

export const cardItem: Variants = {
	hidden: { opacity: 0, y: 20, scale: 0.97 },
	visible: {
		opacity: 1,
		y: 0,
		scale: 1,
		transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] },
	},
};

export const pillContainer: Variants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: { staggerChildren: 0.04, delayChildren: 0.05 },
	},
	exit: {
		opacity: 0,
		transition: { duration: 0.15 },
	},
};

export const pillItem: Variants = {
	hidden: { opacity: 0, scale: 0.85, y: 6 },
	visible: {
		opacity: 1,
		scale: 1,
		y: 0,
		transition: { duration: 0.3, ease: [0.23, 1, 0.32, 1] },
	},
};

export const footerVariants: Variants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: { duration: 0.6, delay: 0.3, ease: "easeOut" },
	},
};
