export function cpfDigits(value: string) {
    return value.replace(/\D/g, '');
}

export function formatCpfInput(value: string) {
    const digits = cpfDigits(value).slice(0, 11);
    const groups = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)].filter(Boolean);
    const checkDigits = digits.slice(9);
    return groups.join('.') + (checkDigits ? '-' + checkDigits : '');
}
