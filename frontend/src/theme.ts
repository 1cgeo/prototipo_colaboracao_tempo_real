// src/theme.ts
import { createTheme } from '@mui/material/styles';
import { blue, orange } from '@mui/material/colors';

const theme = createTheme({
  palette: {
    primary: {
      main: blue[700],
    },
    secondary: {
      main: orange[500],
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
  },
});

export default theme;