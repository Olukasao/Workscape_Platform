/** Compara pelos 8 últimos dígitos (ignora DDD, código do país e o 9º dígito), como a ficha da ligação. */
export const final8 = (n: string) => n.replace(/\D/g, "").slice(-8);
export const mesmoNumero = (a: string, b: string) => final8(a).length === 8 && final8(a) === final8(b);
