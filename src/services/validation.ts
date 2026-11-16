import {z} from 'zod';

export const foodCategorySchema = z.enum([
  'Cereais e tubérculos',
  'Frutas',
  'Legumes e verduras',
  'Leguminosas',
  'Carnes e proteínas',
  'Laticínios',
  'Pães e massas',
  'Bebidas',
  'Doces e biscoitos',
  'Temperos, molhos e óleos',
  'Sementes, castanhas e farinhas',
  'Outros',
]);

export const foodPreparationSchema = z.enum([
  'cozido',
  'cru',
  'assado',
  'grelhado',
  'frito',
  'pronto',
  'industrializado',
  'congelado',
  'enlatado',
]);

export const measureUnitKeySchema = z.enum([
  'grama',
  'quilograma',
  'colher_sopa',
  'colher_cha',
  'xicara',
  'copo',
  'concha',
  'fatia',
  'unidade',
  'porcao',
  'mililitro',
  'prato',
  'pote',
]);

export const mealTypeSchema = z.enum([
  'cafe_manha',
  'lanche_manha',
  'almoco',
  'lanche_tarde',
  'jantar',
  'ceia',
]);

export const glucoseContextSchema = z.enum([
  'jejum',
  'antes_refeicao',
  'apos_2h',
  'aleatoria',
  'antes_dormir',
]);

export const customFoodInputSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do alimento (mínimo 2 caracteres).'),
  category: foodCategorySchema,
  description: z.string().trim().min(2, 'Informe uma descrição ou marca.'),
  brand: z.string().trim().optional(),
  preparation: foodPreparationSchema,
  carbsTotalPer100g: z
    .number({message: 'Informe os carboidratos por 100 g.'})
    .min(0, 'Carboidratos não podem ser negativos.')
    .max(100, 'Valor por 100 g deve ser no máximo 100 g.'),
  carbsAvailablePer100g: z
    .number()
    .min(0, 'Carboidratos disponíveis não podem ser negativos.')
    .max(100, 'Valor por 100 g deve ser no máximo 100 g.')
    .optional(),
  fiberPer100g: z.number().min(0).max(100).optional(),
  sugarPer100g: z.number().min(0).max(100).optional(),
  proteinPer100g: z.number().min(0).max(100).optional(),
  totalFatPer100g: z.number().min(0).max(100).optional(),
  caloriesPer100g: z
    .number()
    .min(0, 'Calorias não podem ser negativas.')
    .max(950, 'Valor calórico por 100 g inválido.')
    .optional(),
  sourceName: z.string().trim().min(2, 'Informe a fonte dos dados.'),
  referenceCode: z.string().trim().min(1, 'Informe o código ou referência.'),
  barcode: z.string().trim().optional(),
  measureLabel: z.string().trim().optional(),
  measureGrams: z.number().positive('O peso da medida deve ser maior que zero.').optional(),
});

export const quantityInputSchema = z
  .number({message: 'Informe uma quantidade numérica válida.'})
  .finite('Quantidade inválida.')
  .positive('A quantidade deve ser maior que zero.');

export const glucoseInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Horário inválido.'),
  valueMgDl: z
    .number({message: 'Informe o valor da glicemia.'})
    .int('Informe um número inteiro em mg/dL.')
    .min(20, 'Valor mínimo: 20 mg/dL.')
    .max(900, 'Valor máximo: 900 mg/dL.'),
  context: glucoseContextSchema,
  mealType: mealTypeSchema.optional(),
  notes: z.string().max(400, 'Observação muito longa.').optional(),
});

export const insulinInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Horário inválido.'),
  insulinType: z.string().trim().min(2, 'Informe o tipo de insulina.'),
  units: z
    .number({message: 'Informe a quantidade em unidades (UI).'})
    .positive('A quantidade aplicada deve ser maior que zero.')
    .max(200, 'Confira o valor informado (máx. 200 UI por registro).'),
  mealType: mealTypeSchema.optional(),
  notes: z.string().max(400, 'Observação muito longa.').optional(),
});

export const recipeInputSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome da receita.'),
  description: z.string().trim().max(500).optional(),
  servings: z
    .number({message: 'Informe o número de porções.'})
    .int('Porções deve ser um número inteiro.')
    .min(1, 'Mínimo 1 porção.')
    .max(100, 'Máximo 100 porções.'),
});

export const pinInputSchema = z
  .string()
  .regex(/^\d{4,8}$/, 'A senha PIN deve ter entre 4 e 8 dígitos numéricos.');

export const userRegistrationSchema = z.object({
  fullName: z.string().trim().min(2, 'Informe seu nome completo.'),
  displayName: z.string().trim().min(2, 'Informe seu nome de exibição.'),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe uma data de nascimento válida.'),
  password: z.string().min(4, 'A senha deve ter pelo menos 4 caracteres.'),
  sex: z.enum(['feminino', 'masculino', 'outro', 'nao_informar']).optional(),
  heightCm: z.number().min(40).max(260).optional(),
  diabetesType: z.string().trim().max(80).optional(),
  diagnosisDate: z.string().trim().max(20).optional(),
  treatmentType: z.string().trim().max(120).optional(),
  personalNotes: z.string().trim().max(500).optional(),
});
