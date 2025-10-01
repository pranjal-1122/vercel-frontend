// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyDMRi-j71wruX5UPFg1kB2pbB99q0Sp9qk",
    authDomain: "b-buddy-4c0a7.firebaseapp.com",
    databaseURL: "https://b-buddy-4c0a7-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "b-buddy-4c0a7",
    storageBucket: "b-buddy-4c0a7.firebasestorage.app",
    messagingSenderId: "1046417860101",
    appId: "1:1046417860101:web:80dd34f12c5dc06dd65e6c",
    measurementId: "G-39M5NFMMMQ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// Backend API URL
const API_URL = 'http://localhost:3000';

// Auth System Variables
let userEmail = '';
let resendTimer = null;
let resendCountdown = 60;

// Email validation
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Start resend timer
function startResendTimer() {
    const resendLink = document.getElementById('resendOtp');
    resendCountdown = 60;
    resendLink.classList.add('disabled');
    resendLink.style.pointerEvents = 'none';

    resendTimer = setInterval(() => {
        resendCountdown--;
        resendLink.textContent = `Resend OTP (${resendCountdown}s)`;

        if (resendCountdown <= 0) {
            clearInterval(resendTimer);
            resendLink.textContent = 'Resend OTP';
            resendLink.classList.remove('disabled');
            resendLink.style.pointerEvents = 'auto';
        }
    }, 1000);
}

// Switch between Signup and Login
document.getElementById('switchToLogin').addEventListener('click', function (e) {
    e.preventDefault();
    document.getElementById('signupBox').style.display = 'none';
    document.getElementById('loginBox').style.display = 'block';
    document.getElementById('resetPasswordBox').style.display = 'none';
});

document.getElementById('switchToSignup').addEventListener('click', function (e) {
    e.preventDefault();
    document.getElementById('loginBox').style.display = 'none';
    document.getElementById('signupBox').style.display = 'block';
    document.getElementById('resetPasswordBox').style.display = 'none';
});

// SIGNUP FLOW

// Send OTP
document.getElementById('sendOtpBtn').addEventListener('click', async function () {
    const email = document.getElementById('email').value.trim();
    const emailError = document.getElementById('emailError');
    const sendBtn = this;

    if (!email) {
        emailError.textContent = 'Please enter your email';
        emailError.style.display = 'block';
        return;
    }

    if (!validateEmail(email)) {
        emailError.textContent = 'Please enter a valid email address';
        emailError.style.display = 'block';
        return;
    }

    emailError.style.display = 'none';
    userEmail = email;

    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';

    try {
        const response = await fetch(`${API_URL}/api/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            alert(`OTP sent to ${email}!\n\nPlease check your email inbox.`);
            document.getElementById('emailStep').style.display = 'none';
            document.getElementById('otpStep').style.display = 'block';
            document.getElementById('displayEmail').textContent = email;
            startResendTimer();
            document.querySelector('.otp-input').focus();
        } else {
            emailError.textContent = data.message || 'Failed to send OTP. Please try again.';
            emailError.style.display = 'block';
        }
    } catch (error) {
        console.error('Error sending OTP:', error);
        emailError.textContent = 'Network error. Make sure your backend server is running.';
        emailError.style.display = 'block';
    } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send OTP';
    }
});

// OTP Input handling
const otpInputs = document.querySelectorAll('.otp-input');

otpInputs.forEach((input, index) => {
    input.addEventListener('input', function (e) {
        if (this.value.length === 1 && index < otpInputs.length - 1) {
            otpInputs[index + 1].focus();
        }
    });

    input.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && this.value === '' && index > 0) {
            otpInputs[index - 1].focus();
        }
    });

    input.addEventListener('keypress', function (e) {
        if (!/[0-9]/.test(e.key)) {
            e.preventDefault();
        }
    });
});

// Verify OTP
document.getElementById('verifyOtpBtn').addEventListener('click', async function () {
    let enteredOTP = '';
    otpInputs.forEach(input => {
        enteredOTP += input.value;
    });

    const otpError = document.getElementById('otpError');
    const otpSuccess = document.getElementById('otpSuccess');
    const verifyBtn = this;

    if (enteredOTP.length !== 6) {
        otpError.textContent = 'Please enter complete OTP';
        otpError.style.display = 'block';
        otpSuccess.style.display = 'none';
        return;
    }

    verifyBtn.disabled = true;
    verifyBtn.textContent = 'Verifying...';
    otpError.style.display = 'none';
    otpSuccess.style.display = 'none';

    try {
        const response = await fetch(`${API_URL}/api/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail, otp: enteredOTP })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            otpSuccess.textContent = 'OTP verified successfully!';
            otpSuccess.style.display = 'block';

            if (resendTimer) clearInterval(resendTimer);

            setTimeout(() => {
                document.getElementById('otpStep').style.display = 'none';
                document.getElementById('userInfoStep').style.display = 'block';
                document.querySelector('#signupBox h2').textContent = 'Complete Your Profile';
                document.querySelector('#signupBox p').textContent = 'Set up your username and password';
            }, 1000);
        } else {
            otpError.textContent = data.message || 'Invalid OTP. Please try again.';
            otpError.style.display = 'block';
            otpInputs.forEach(input => input.value = '');
            otpInputs[0].focus();
        }
    } catch (error) {
        console.error('Error verifying OTP:', error);
        otpError.textContent = 'Network error. Make sure your backend server is running.';
        otpError.style.display = 'block';
    } finally {
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Verify OTP';
    }
});

// Resend OTP
document.getElementById('resendOtp').addEventListener('click', async function () {
    if (this.classList.contains('disabled')) return;

    const resendLink = this;
    const originalText = resendLink.textContent;

    try {
        resendLink.textContent = 'Sending...';
        resendLink.style.pointerEvents = 'none';

        const response = await fetch(`${API_URL}/api/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            alert(`New OTP sent to ${userEmail}!`);
            otpInputs.forEach(input => input.value = '');
            otpInputs[0].focus();
            startResendTimer();
        } else {
            alert('Failed to resend OTP. Please try again.');
            resendLink.textContent = originalText;
            resendLink.style.pointerEvents = 'auto';
        }
    } catch (error) {
        console.error('Error resending OTP:', error);
        alert('Network error. Make sure your backend server is running.');
        resendLink.textContent = originalText;
        resendLink.style.pointerEvents = 'auto';
    }
});

// Change Email
document.getElementById('changeEmail').addEventListener('click', function () {
    if (resendTimer) clearInterval(resendTimer);
    otpInputs.forEach(input => input.value = '');
    document.getElementById('otpStep').style.display = 'none';
    document.getElementById('emailStep').style.display = 'block';
    document.getElementById('email').value = userEmail;
    document.getElementById('email').focus();
});

// Complete Signup with Firebase
document.getElementById('confirmBtn').addEventListener('click', async function () {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    const usernameError = document.getElementById('usernameError');
    const passwordError = document.getElementById('passwordError');
    const confirmPasswordError = document.getElementById('confirmPasswordError');
    const confirmBtn = this;

    // Reset errors
    usernameError.style.display = 'none';
    passwordError.style.display = 'none';
    confirmPasswordError.style.display = 'none';

    // Validate username
    if (!username) {
        usernameError.textContent = 'Please enter a username';
        usernameError.style.display = 'block';
        return;
    }

    if (username.length < 3) {
        usernameError.textContent = 'Username must be at least 3 characters';
        usernameError.style.display = 'block';
        return;
    }

    // Validate password
    if (!password) {
        passwordError.textContent = 'Please enter a password';
        passwordError.style.display = 'block';
        return;
    }

    if (password.length < 6) {
        passwordError.textContent = 'Password must be at least 6 characters';
        passwordError.style.display = 'block';
        return;
    }

    // Validate confirm password
    if (password !== confirmPassword) {
        confirmPasswordError.textContent = 'Passwords do not match';
        confirmPasswordError.style.display = 'block';
        return;
    }

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Creating Account...';

    try {
        // Create Firebase user
        const userCredential = await auth.createUserWithEmailAndPassword(userEmail, password);
        const user = userCredential.user;

        // Save user data to Realtime Database
        await database.ref('users/' + user.uid).set({
            username: username,
            email: userEmail,
            createdAt: new Date().toISOString()
        });

        console.log('User registered:', user.uid);
        alert(`Welcome, ${username}! Your account has been created successfully.`);

        // Show success screen with Welcome Aboard button
        document.querySelector('#signupBox h2').textContent = 'Welcome to B-Buddy!';
        document.querySelector('#signupBox p').textContent = `Account created for ${username}`;
        document.getElementById('userInfoStep').innerHTML = `
            <div style="text-align: center; padding: 40px 0;">
                <div style="font-size: 60px; margin-bottom: 20px;">✅</div>
                <h3 style="font-size: 24px; margin-bottom: 12px;">Registration Complete</h3>
                <p style="color: #94a3b8; margin-bottom: 30px;">You can now start earning with B-Buddy</p>
                <button class="welcome-aboard-btn" onclick="window.location.href='dashboard.html'">
                    Welcome Aboard - Go to Dashboard
                </button>
            </div>
        `;

    } catch (error) {
        console.error('Error creating account:', error);
        let errorMessage = 'Failed to create account. Please try again.';

        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'This email is already registered. Please log in instead.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password is too weak. Please use a stronger password.';
        }

        usernameError.textContent = errorMessage;
        usernameError.style.display = 'block';

        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Create Account';
    }
});

// LOGIN FLOW

document.getElementById('loginBtn').addEventListener('click', async function () {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    const emailError = document.getElementById('loginEmailError');
    const passwordError = document.getElementById('loginPasswordError');
    const loginBtn = this;

    // Reset errors
    emailError.style.display = 'none';
    passwordError.style.display = 'none';

    // Validate email
    if (!email) {
        emailError.textContent = 'Please enter your email';
        emailError.style.display = 'block';
        return;
    }

    if (!validateEmail(email)) {
        emailError.textContent = 'Please enter a valid email address';
        emailError.style.display = 'block';
        return;
    }

    // Validate password
    if (!password) {
        passwordError.textContent = 'Please enter your password';
        passwordError.style.display = 'block';
        return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging In...';

    try {
        // Sign in with Firebase
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Get username from database
        const snapshot = await database.ref('users/' + user.uid).once('value');
        const userData = snapshot.val();

        console.log('User logged in:', user.uid);
        alert(`Welcome back, ${userData.username}!`);

        // Show success screen with Welcome Aboard button
        document.querySelector('#loginBox h2').textContent = 'Login Successful!';
        document.querySelector('#loginBox p').textContent = `Welcome back, ${userData.username}`;
        document.querySelector('#loginBox .auth-form').innerHTML = `
            <div style="text-align: center; padding: 40px 0;">
                <div style="font-size: 60px; margin-bottom: 20px;">✅</div>
                <h3 style="font-size: 24px; margin-bottom: 12px;">Login Successful</h3>
                <p style="color: #94a3b8; margin-bottom: 30px;">Redirecting to dashboard...</p>
                <button class="welcome-aboard-btn" onclick="window.location.href='dashboard.html'">
                    Welcome Aboard - Go to Dashboard
                </button>
            </div>
        `;

    } catch (error) {
        console.error('Error logging in:', error);
        let errorMessage = 'Failed to log in. Please try again.';

        if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email. Please sign up.';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password. Please try again.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address.';
        }

        passwordError.textContent = errorMessage;
        passwordError.style.display = 'block';

        loginBtn.disabled = false;
        loginBtn.textContent = 'Log In';
    }
});

// FORGOT PASSWORD FLOW

// Show Reset Password Box
document.getElementById('forgotPasswordLink').addEventListener('click', function (e) {
    e.preventDefault();
    document.getElementById('loginBox').style.display = 'none';
    document.getElementById('resetPasswordBox').style.display = 'block';
    document.getElementById('signupBox').style.display = 'none';
});

// Back to Login from Reset Password
document.getElementById('backToLogin').addEventListener('click', function (e) {
    e.preventDefault();
    document.getElementById('resetPasswordBox').style.display = 'none';
    document.getElementById('loginBox').style.display = 'block';
    // Clear reset password fields
    document.getElementById('resetEmail').value = '';
    document.getElementById('resetEmailError').style.display = 'none';
    document.getElementById('resetEmailSuccess').style.display = 'none';
});

// Send Password Reset Email
document.getElementById('resetPasswordBtn').addEventListener('click', async function () {
    const email = document.getElementById('resetEmail').value.trim();
    const emailError = document.getElementById('resetEmailError');
    const emailSuccess = document.getElementById('resetEmailSuccess');
    const resetBtn = this;

    // Reset messages
    emailError.style.display = 'none';
    emailSuccess.style.display = 'none';

    // Validate email
    if (!email) {
        emailError.textContent = 'Please enter your email';
        emailError.style.display = 'block';
        return;
    }

    if (!validateEmail(email)) {
        emailError.textContent = 'Please enter a valid email address';
        emailError.style.display = 'block';
        return;
    }

    resetBtn.disabled = true;
    resetBtn.textContent = 'Sending...';

    try {
        // Send password reset email using Firebase
        await auth.sendPasswordResetEmail(email);

        console.log('Password reset email sent to:', email);
        emailSuccess.textContent = 'Password reset link sent! Check your email.';
        emailSuccess.style.display = 'block';

        // Clear the email field
        document.getElementById('resetEmail').value = '';

        // Redirect back to login after 3 seconds
        setTimeout(() => {
            document.getElementById('resetPasswordBox').style.display = 'none';
            document.getElementById('loginBox').style.display = 'block';
            emailSuccess.style.display = 'none';
        }, 3000);

    } catch (error) {
        console.error('Error sending password reset email:', error);
        let errorMessage = 'Failed to send reset email. Please try again.';

        if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address.';
        }

        emailError.textContent = errorMessage;
        emailError.style.display = 'block';
    } finally {
        resetBtn.disabled = false;
        resetBtn.textContent = 'Send Reset Link';
    }
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href !== '#' && href.length > 1) {
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    });
});

// Parallax effect
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const heroTitle = document.querySelector('.hero h1');
    const heroSubtitle = document.querySelector('.hero .subtitle');
    const heroButtons = document.querySelector('.hero-buttons');

    if (heroTitle && scrolled < 400) {
        heroTitle.style.transform = `translateY(${scrolled * 0.3}px)`;
        heroTitle.style.opacity = 1 - (scrolled * 0.002);
    }
    if (heroSubtitle && scrolled < 400) {
        heroSubtitle.style.transform = `translateY(${scrolled * 0.3}px)`;
        heroSubtitle.style.opacity = 1 - (scrolled * 0.002);
    }
    if (heroButtons && scrolled < 400) {
        heroButtons.style.transform = `translateY(${scrolled * 0.3}px)`;
        heroButtons.style.opacity = 1 - (scrolled * 0.002);
    }
});

// Intersection Observer for animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

document.querySelectorAll('.feature-card, .step, .stat-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});