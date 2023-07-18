// main.js
new Vue({
    el: '#app',
    data() {
      return {
        authenticated: false,
        user: null,
        backendURL: 'http://localhost:3000', // Update with your backend URL
        loginEmail: '',
        loginPassword: '',
        signupEmail: '',
        signupPassword: '',
      };
    },
    methods: {
      async login() {
        try {
          const response = await axios.post(`${this.backendURL}/auth/login`, {
            email: this.loginEmail,
            password: this.loginPassword,
          });
          const { token } = response.data;
          this.updateToken(token);
        } catch (error) {
          console.error(error);
        }
      },
      loginWithGoogle() {
        // Redirect the user to the Google login route on the backend
        window.location.href = `${this.backendURL}/auth/google`;
      },
      async signup() {
        try {
          const response = await axios.post(`${this.backendURL}/auth/signup`, {
            email: this.signupEmail,
            password: this.signupPassword,
          });
          const { token } = response.data;
          this.updateToken(token);
        } catch (error) {
          console.error(error);
        }
      },
      logout() {
        this.authenticated = false;
        this.user = null;
        localStorage.removeItem('token');
      },
      updateToken(token) {
        localStorage.setItem('token', token);
        this.authenticated = true;
        this.authenticate();
        // const decodedToken = jwt_decode(token);
        // this.user = { email: decodedToken.email };
      },
      async authenticate() {
        try {
          let tokenData = localStorage.getItem('token');
          const response = await axios.get(`${this.backendURL}/authenticated?token=${tokenData}`);
          const { email } = response.data;
          this.user = {
            email: email
          }
        } catch (error) {
          console.error(error);
        }
      },
      handleRedirect() {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        if (token) {
          this.updateToken(token);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      },
    },
    created() {
      const token = localStorage.getItem('token');
      if (token) {
        this.updateToken(token);
      }
      this.handleRedirect();
    },
  });
  