// The component renderer has no Android window to provide native insets.
require('@jest/globals').jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
// The native gesture runtime does not exist under Jest; use the setup the package ships.
require('react-native-gesture-handler/jestSetup');
