package phone

import "unicode"

// Normalize keeps only digits so phone matching is independent from UI formatting.
func Normalize(value string) string {
	digits := make([]rune, 0, len(value))
	for _, r := range value {
		if unicode.IsDigit(r) {
			digits = append(digits, r)
		}
	}
	return string(digits)
}
