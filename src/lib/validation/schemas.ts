import { z } from "zod";

export const createCommitteeSchema = z
  .object({
    setupPassphrase: z.string().min(1),
    name: z.string().trim().min(1).max(100),
    monthlyContribution: z.number().int().positive(),
    durationMonths: z.number().int().min(3).max(60),
    reservedMonthNumber: z.number().int().positive(),
    runnerUpBonus: z.number().int().nonnegative(),
    adminPin: z
      .string()
      .regex(/^\d{4,6}$/, "PIN must be 4-6 digits"),
    memberNames: z.array(z.string().trim().min(1).max(60)).min(3).max(40),
    holderIndex: z.number().int().nonnegative(),
  })
  .refine((v) => v.reservedMonthNumber <= v.durationMonths, {
    message: "reservedMonthNumber must be within durationMonths",
    path: ["reservedMonthNumber"],
  })
  .refine((v) => v.holderIndex < v.memberNames.length, {
    message: "holderIndex must reference a member in memberNames",
    path: ["holderIndex"],
  })
  .refine((v) => v.runnerUpBonus < v.monthlyContribution, {
    message: "runnerUpBonus must be less than monthlyContribution",
    path: ["runnerUpBonus"],
  });

export type CreateCommitteeInput = z.infer<typeof createCommitteeSchema>;

export const pinLoginSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/),
});

export const auctionResultSchema = z.union([
  z.object({ isReserved: z.literal(true) }),
  z.object({
    isReserved: z.literal(false),
    winnerMemberId: z.string().uuid(),
    winningBid: z
      .number()
      .int()
      .positive()
      .refine((n) => n % 500 === 0, "winningBid must be a multiple of 500"),
    runnerUpMemberId: z.string().uuid(),
  }),
]);

export const paymentSchema = z.object({
  memberId: z.string().uuid(),
  amount: z.number().int().positive(),
  mode: z.enum(["cash", "upi"]),
  note: z.string().trim().max(200).optional(),
});

export const updateSettingsSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  runnerUpBonus: z.number().int().nonnegative().optional(),
  reservedMonthNumber: z.number().int().positive().optional(),
  showProfitLoss: z.boolean().optional(),
});

export const changePinSchema = z.object({
  currentPin: z.string().regex(/^\d{4,6}$/),
  newPin: z.string().regex(/^\d{4,6}$/),
});
