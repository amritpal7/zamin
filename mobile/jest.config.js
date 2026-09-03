// jest-expo preset: babel-transforms RN/Expo modules and sets up the RN env.
// We only unit-test pure helpers today, but the preset keeps the door open for
// component tests later without reconfiguring.
module.exports = {
  preset: "jest-expo",
  testMatch: ["**/__tests__/**/*.test.js"],
  // Transform the RN/Expo ESM packages that ship untranspiled.
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg))",
  ],
};
