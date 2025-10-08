// Gemini AI Config:
const GEMINI_API_KEY = CONFIG.gemini.apiKey;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
// Changed from gemini-pro to gemini-1.5-flash (more reliable and faster)

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getDatabase, ref, onValue, push, set, update, get } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';

// const firebaseConfig = {
//     apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDMRi-j71wruX5UPFg1kB2pbB99q0Sp9qk",
//     authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "b-buddy-4c0a7.firebaseapp.com",
//     databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://b-buddy-4c0a7-default-rtdb.asia-southeast1.firebasedatabase.app",
//     projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "b-buddy-4c0a7",
//     storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "b-buddy-4c0a7.firebasestorage.app",
//     messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1046417860101",
//     appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1046417860101:web:80dd34f12c5dc06dd65e6c",
//     measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-39M5NFMMMQ"
// };

const firebaseConfig = CONFIG.firebase;

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let currentUser = null;
let chartInstance = null;
let isRealUser = false;
let pendingBudgetAmount = 0;
let pendingSavingsGoal = 0;

// Demo data for testing
const demoData = {
    monthlyBudgets: {},
    expenses: {}
};

// Get current month key (YYYY-MM)
function getCurrentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Auth state listener
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        isRealUser = true;

        // Fetch username from database
        try {
            const userRef = ref(db, `users/${user.uid}`);
            const snapshot = await get(userRef);
            const userData = snapshot.val();

            if (userData && userData.username) {
                // Use username from database
                document.getElementById('userName').textContent = userData.username;
                document.getElementById('userAvatar').textContent = userData.username[0].toUpperCase();
            } else {
                // Fallback to email if username not found
                const displayName = user.email.split('@')[0];
                document.getElementById('userName').textContent = displayName;
                document.getElementById('userAvatar').textContent = displayName[0].toUpperCase();
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            // Fallback to email on error
            const displayName = user.email.split('@')[0];
            document.getElementById('userName').textContent = displayName;
            document.getElementById('userAvatar').textContent = displayName[0].toUpperCase();
        }

        loadUserData(user.uid);
    } else {
        // Demo mode
        currentUser = { uid: 'demo-user' };
        isRealUser = false;
        updateDashboard(demoData);
        updateBudgetButtonState(demoData);
    }
});

// Load user data from Firebase
function loadUserData(uid) {
    const userRef = ref(db, `users/${uid}`);
    onValue(userRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            updateDashboard(data);
            updateBudgetButtonState(data);
        } else {
            // Initialize new user with default values
            const defaultData = {
                monthlyBudgets: {},
                expenses: {}
            };
            set(userRef, defaultData);
            updateDashboard(defaultData);
            updateBudgetButtonState(defaultData);
        }
    });
}

// Check if budget is set for current month
function isBudgetSetForCurrentMonth(data) {
    const currentMonth = getCurrentMonthKey();
    return data.monthlyBudgets && data.monthlyBudgets[currentMonth] &&
        data.monthlyBudgets[currentMonth].budget !== undefined;
}

// Get cumulative totals from all months
function getCumulativeTotals(data) {
    const monthlyBudgets = data.monthlyBudgets || {};
    let totalBudget = 0;
    let totalSavings = 0;

    Object.values(monthlyBudgets).forEach(month => {
        if (month.budget) totalBudget += parseFloat(month.budget);
        if (month.savingsGoal) totalSavings += parseFloat(month.savingsGoal);
    });

    return { totalBudget, totalSavings };
}

// Calculate total spent and remaining for current month
function getCurrentMonthSpending(data) {
    const currentMonth = getCurrentMonthKey();
    const expenses = data.expenses || {};
    const currentBudget = (data.monthlyBudgets && data.monthlyBudgets[currentMonth])
        ? parseFloat(data.monthlyBudgets[currentMonth].budget || 0)
        : 0;

    let totalSpent = 0;
    const categoryTotals = {};
    const transactionsArray = [];

    Object.entries(expenses).forEach(([id, expense]) => {
        // Check if expense belongs to current month
        if (expense.timestamp) {
            const expenseDate = new Date(expense.timestamp);
            const expenseMonth = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}`;

            if (expenseMonth === currentMonth) {
                totalSpent += parseFloat(expense.amount);
                categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + parseFloat(expense.amount);
                transactionsArray.push({ id, ...expense });
            }
        }
    });

    return { totalSpent, categoryTotals, transactionsArray, currentBudget };
}

// Update budget button state based on lock status
function updateBudgetButtonState(data) {
    const setBudgetBtn = document.getElementById('setBudgetBtn');
    const budgetSet = isBudgetSetForCurrentMonth(data);

    if (budgetSet) {
        setBudgetBtn.disabled = true;
        setBudgetBtn.style.opacity = '0.5';
        setBudgetBtn.style.cursor = 'not-allowed';
        setBudgetBtn.innerHTML = `
            <span class="btn-icon">🔒</span>
            <span>Budget Set for This Month</span>
        `;
        setBudgetBtn.title = 'Budget is already set for this month';
    } else {
        setBudgetBtn.disabled = false;
        setBudgetBtn.style.opacity = '1';
        setBudgetBtn.style.cursor = 'pointer';
        setBudgetBtn.innerHTML = `
            <span class="btn-icon"></span>
            <span>Set Monthly Budget</span>
        `;
        setBudgetBtn.title = 'Click to set your monthly budget';
    }
}

// Update dashboard with user data
function updateDashboard(data) {
    const { totalSpent, categoryTotals, transactionsArray, currentBudget } = getCurrentMonthSpending(data);
    const { totalBudget, totalSavings } = getCumulativeTotals(data);

    const remaining = currentBudget - totalSpent;
    const remainingPercent = currentBudget > 0 ? (remaining / currentBudget) * 100 : 0;

    document.getElementById('totalSpent').textContent = `₹${totalSpent.toFixed(2)}`;
    document.getElementById('remainingBudget').textContent = `₹${remaining.toFixed(2)}`;

    // Update remaining budget color based on percentage
    const budgetValue = document.getElementById('remainingBudget');

    if (currentBudget === 0) {
        // No budget set - blue gradient
        budgetValue.style.background = 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)';
        budgetValue.style.webkitBackgroundClip = 'text';
        budgetValue.style.webkitTextFillColor = 'transparent';
        budgetValue.style.backgroundClip = 'text';
    } else if (remainingPercent >= 75) {
        // 100% to 75% - green gradient
        budgetValue.style.background = 'linear-gradient(135deg, #10b981 0%, #047857 100%)';
        budgetValue.style.webkitBackgroundClip = 'text';
        budgetValue.style.webkitTextFillColor = 'transparent';
        budgetValue.style.backgroundClip = 'text';
    } else if (remainingPercent >= 50) {
        // 75% to 50% - light green to yellow gradient
        budgetValue.style.background = 'linear-gradient(135deg, #84cc16 0%, #eab308 100%)';
        budgetValue.style.webkitBackgroundClip = 'text';
        budgetValue.style.webkitTextFillColor = 'transparent';
        budgetValue.style.backgroundClip = 'text';
    } else if (remainingPercent >= 10) {
        // 50% to 10% - yellow to red gradient
        budgetValue.style.background = 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)';
        budgetValue.style.webkitBackgroundClip = 'text';
        budgetValue.style.webkitTextFillColor = 'transparent';
        budgetValue.style.backgroundClip = 'text';
    } else {
        // Less than 10% - red gradient
        budgetValue.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        budgetValue.style.webkitBackgroundClip = 'text';
        budgetValue.style.webkitTextFillColor = 'transparent';
        budgetValue.style.backgroundClip = 'text';
    }

    // Update highest spent transaction
    updateHighestSpent(data);

    updateChart(categoryTotals);
    updateTransactionsList(transactionsArray);
}

// Update highest spent transaction
function updateHighestSpent(data) {
    const expenses = data.expenses || {};
    let highestExpense = null;
    let maxAmount = 0;

    // Find the expense with highest amount
    Object.entries(expenses).forEach(([id, expense]) => {
        const amount = parseFloat(expense.amount);
        if (amount > maxAmount) {
            maxAmount = amount;
            highestExpense = expense;
        }
    });

    const amountElement = document.getElementById('highestSpentAmount');
    const categoryElement = document.getElementById('highestSpentCategory');
    const descriptionElement = document.getElementById('highestSpentDescription');

    if (highestExpense) {
        amountElement.textContent = `₹${parseFloat(highestExpense.amount).toFixed(2)}`;
        categoryElement.textContent = highestExpense.category;
        descriptionElement.textContent = highestExpense.description;
        descriptionElement.classList.remove('empty');
    } else {
        amountElement.textContent = '₹0.00';
        categoryElement.textContent = 'No category';
        descriptionElement.textContent = 'No expenses recorded yet.';
        descriptionElement.classList.add('empty');
    }
}

// Update spending chart
function updateChart(categoryTotals) {
    const ctx = document.getElementById('spendingChart').getContext('2d');
    const categories = Object.keys(categoryTotals);
    const amounts = Object.values(categoryTotals);

    const colors = [
        '#8b85ff', '#a78bfa', '#c084fc', '#e879f9',
        '#f0abfc', '#fbbf24', '#fb923c', '#f87171'
    ];

    if (chartInstance) {
        chartInstance.destroy();
    }

    // Always show chart, even with no data
    if (categories.length === 0) {
        // Show placeholder chart
        chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['No Data'],
                datasets: [{
                    data: [1],
                    backgroundColor: ['#3f3f46'],
                    borderWidth: 2,
                    borderColor: '#252938'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false
                    }
                }
            }
        });
        return;
    }

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: categories,
            datasets: [{
                data: amounts,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#252938'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            layout: {
                padding: {
                    top: 10,
                    bottom: 10,
                    left: 10,
                    right: 10
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,              // Increased from 15 - more space between labels
                        font: {
                            size: 15,             // Increased from 12 - larger font
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto'
                        },
                        color: '#a1a1aa',
                        usePointStyle: true,
                        pointStyle: 'circle',
                        boxWidth: 10,             // Increased from 8 - larger dots
                        boxHeight: 10             // Increased from 8 - larger dots
                    }
                },
                tooltip: {
                    backgroundColor: '#1a1d2e',
                    titleColor: '#fafafa',
                    bodyColor: '#a1a1aa',
                    borderColor: '#3f3f46',
                    borderWidth: 1,
                    padding: 15,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 16
                    },
                    displayColors: true,
                    boxWidth: 12,
                    boxHeight: 12,
                    boxPadding: 6,
                    callbacks: {
                        label: function (context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ₹${value.toFixed(2)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Update transactions list
function updateTransactionsList(transactions) {
    const list = document.getElementById('transactionsList');

    if (transactions.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <p>No transactions yet. Add your first expense!</p>
            </div>
        `;
        return;
    }

    transactions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    list.innerHTML = transactions.slice(0, 10).map(t => `
        <div class="transaction-item">
            <div class="transaction-info">
                <div class="transaction-category">${t.category}</div>
                <div class="transaction-desc">${t.description}</div>
            </div>
            <div class="transaction-amount">₹${parseFloat(t.amount).toFixed(2)}</div>
        </div>
    `).join('');
}

// Modal controls - Expense Modal
const expenseModal = document.getElementById('expenseModal');
const addBtn = document.getElementById('addExpenseBtn');
const closeBtn = document.getElementById('closeModal');

// Check budget before allowing expense addition
addBtn.addEventListener('click', async () => {
    if (isRealUser) {
        const userRef = ref(db, `users/${currentUser.uid}`);
        const snapshot = await get(userRef);
        const data = snapshot.val() || {};

        if (!isBudgetSetForCurrentMonth(data)) {
            budgetModal.classList.add('active');
            return;
        }
    } else {
        if (!isBudgetSetForCurrentMonth(demoData)) {
            budgetModal.classList.add('active');
            return;
        }
    }

    expenseModal.classList.add('active');
});

closeBtn.addEventListener('click', () => expenseModal.classList.remove('active'));
expenseModal.addEventListener('click', (e) => {
    if (e.target === expenseModal) expenseModal.classList.remove('active');
});

// Budget Modal controls
const budgetModal = document.getElementById('budgetModal');
const setBudgetBtn = document.getElementById('setBudgetBtn');
const closeBudgetModal = document.getElementById('closeBudgetModal');
const confirmationPopup = document.getElementById('confirmationPopup');
const agreeCheckbox = document.getElementById('agreeCheckbox');
const confirmBudgetBtn = document.getElementById('confirmBudgetBtn');
const cancelConfirmBtn = document.getElementById('cancelConfirmBtn');
const userDropdown = document.getElementById('userDropdown');
const userAvatar = document.getElementById('userAvatar');
const alreadySetPopup = document.getElementById('alreadySetPopup');
const successPopup = document.getElementById('successPopup');

// Toggle dropdown on avatar click
userAvatar.addEventListener('click', (e) => {
    e.stopPropagation();
    userDropdown.classList.toggle('active');
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!userDropdown.contains(e.target) && !userAvatar.contains(e.target)) {
        userDropdown.classList.remove('active');
    }
});

// Open budget modal from button
setBudgetBtn.addEventListener('click', async () => {
    if (setBudgetBtn.disabled) {
        return;
    }

    if (isRealUser) {
        const userRef = ref(db, `users/${currentUser.uid}`);
        const snapshot = await get(userRef);
        const data = snapshot.val() || {};

        if (isBudgetSetForCurrentMonth(data)) {
            alreadySetPopup.classList.add('active');
        } else {
            budgetModal.classList.add('active');
        }
    } else {
        if (isBudgetSetForCurrentMonth(demoData)) {
            alreadySetPopup.classList.add('active');
        } else {
            budgetModal.classList.add('active');
        }
    }
});

// Open budget modal from dropdown menu
document.getElementById('budgetMenuItem').addEventListener('click', async () => {
    userDropdown.classList.remove('active');

    if (isRealUser) {
        const userRef = ref(db, `users/${currentUser.uid}`);
        const snapshot = await get(userRef);
        const data = snapshot.val() || {};

        if (isBudgetSetForCurrentMonth(data)) {
            alreadySetPopup.classList.add('active');
            return;
        }

        const currentMonth = getCurrentMonthKey();
        const currentBudget = (data.monthlyBudgets && data.monthlyBudgets[currentMonth])
            ? data.monthlyBudgets[currentMonth].budget
            : '';
        const currentGoal = (data.monthlyBudgets && data.monthlyBudgets[currentMonth])
            ? data.monthlyBudgets[currentMonth].savingsGoal
            : '';

        document.getElementById('budgetAmount').value = currentBudget;
        document.getElementById('savingsGoalAmount').value = currentGoal;
        budgetModal.classList.add('active');
    } else {
        if (isBudgetSetForCurrentMonth(demoData)) {
            alreadySetPopup.classList.add('active');
            return;
        }
        budgetModal.classList.add('active');
    }
});

// Close budget modal
closeBudgetModal.addEventListener('click', () => {
    budgetModal.classList.remove('active');
});

budgetModal.addEventListener('click', (e) => {
    if (e.target === budgetModal) {
        budgetModal.classList.remove('active');
    }
});

// Enable/disable confirm button based on checkbox
agreeCheckbox.addEventListener('change', (e) => {
    confirmBudgetBtn.disabled = !e.target.checked;
});

// Budget form submission - opens confirmation popup
document.getElementById('budgetForm').addEventListener('submit', (e) => {
    e.preventDefault();
    pendingBudgetAmount = parseFloat(document.getElementById('budgetAmount').value);
    pendingSavingsGoal = parseFloat(document.getElementById('savingsGoalAmount').value);
    budgetModal.classList.remove('active');
    confirmationPopup.classList.add('active');
});

// Cancel confirmation
cancelConfirmBtn.addEventListener('click', () => {
    confirmationPopup.classList.remove('active');
    agreeCheckbox.checked = false;
    confirmBudgetBtn.disabled = true;
    document.getElementById('budgetForm').reset();
});

// Confirm budget setting
confirmBudgetBtn.addEventListener('click', async () => {
    const currentMonth = getCurrentMonthKey();

    if (isRealUser) {
        const userRef = ref(db, `users/${currentUser.uid}/monthlyBudgets/${currentMonth}`);
        await set(userRef, {
            budget: pendingBudgetAmount,
            savingsGoal: pendingSavingsGoal,
            setDate: new Date().toISOString()
        });
    } else {
        if (!demoData.monthlyBudgets) demoData.monthlyBudgets = {};
        demoData.monthlyBudgets[currentMonth] = {
            budget: pendingBudgetAmount,
            savingsGoal: pendingSavingsGoal,
            setDate: new Date().toISOString()
        };
        updateDashboard(demoData);
        updateBudgetButtonState(demoData);
    }

    // Close popup and reset
    confirmationPopup.classList.remove('active');
    agreeCheckbox.checked = false;
    confirmBudgetBtn.disabled = true;
    document.getElementById('budgetForm').reset();

    // Show success popup
    successPopup.classList.add('active');
});

// Already set popup - Go Back button
document.getElementById('alreadySetGoBack').addEventListener('click', () => {
    alreadySetPopup.classList.remove('active');
});

// Success popup - Go Back button
document.getElementById('successGoBack').addEventListener('click', () => {
    successPopup.classList.remove('active');
});

// Logout functionality
document.getElementById('logoutMenuItem').addEventListener('click', () => {
    userDropdown.classList.remove('active');
    if (isRealUser) {
        auth.signOut().then(() => {
            window.location.href = 'index.html';
        }).catch((error) => {
            console.error('Logout error:', error);
            alert('Error logging out. Please try again.');
        });
    } else {
        window.location.href = 'index.html';
    }
});

// Add expense form
document.getElementById('expenseForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const category = document.getElementById('expenseCategory').value;
    const description = document.getElementById('expenseDescription').value;

    const expense = {
        amount,
        category,
        description,
        timestamp: Date.now()
    };

    if (isRealUser) {
        const expensesRef = ref(db, `users/${currentUser.uid}/expenses`);
        const newExpenseRef = push(expensesRef);
        await set(newExpenseRef, expense);
    } else {
        const expenseId = 'exp' + Date.now();
        if (!demoData.expenses) demoData.expenses = {};
        demoData.expenses[expenseId] = expense;
        updateDashboard(demoData);
    }

    e.target.reset();
    expenseModal.classList.remove('active');
});

// Scroll to chart when Total Spent card is clicked
document.getElementById('totalSpentCard').addEventListener('click', () => {
    document.getElementById('chartSection').scrollIntoView({
        behavior: 'smooth',
        block: 'center'
    });
});

// Chart click handler - opens detailed spending page
document.getElementById('chartContainer').addEventListener('click', () => {
    const currentData = isRealUser ? {} : {
        expenses: demoData.expenses,
        monthlyBudgets: demoData.monthlyBudgets
    };
    const dataStr = encodeURIComponent(JSON.stringify(currentData));
    window.open('spending-details.html?data=' + dataStr, '_blank');
});

// ========================================
// AI CHAT FUNCTIONALITY
// ========================================

const aiChatBtn = document.getElementById('aiChatBtn');
const aiChatWindow = document.getElementById('aiChatWindow');
const aiCloseBtn = document.getElementById('aiCloseBtn');
const aiChatMessages = document.getElementById('aiChatMessages');
const aiChatInput = document.getElementById('aiChatInput');
const aiSendBtn = document.getElementById('aiSendBtn');
const aiQuickBtns = document.querySelectorAll('.ai-quick-btn');

// Toggle chat window - AI button now toggles open/close
aiChatBtn.addEventListener('click', () => {
    const isActive = aiChatWindow.classList.contains('active');

    if (isActive) {
        // Close chat
        aiChatWindow.classList.remove('active');
    } else {
        // Open chat
        aiChatWindow.classList.add('active');
        aiChatInput.focus();
    }
});

// Close button also closes the chat
aiCloseBtn.addEventListener('click', () => {
    aiChatWindow.classList.remove('active');
});

// Rest of your code continues here...

// Quick action buttons
aiQuickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const prompt = btn.getAttribute('data-prompt');
        sendMessageToAI(prompt);
    });
});

// Send message on Enter key
aiChatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const message = aiChatInput.value.trim();
        if (message) {
            sendMessageToAI(message);
        }
    }
});

// Send button click
aiSendBtn.addEventListener('click', () => {
    const message = aiChatInput.value.trim();
    if (message) {
        sendMessageToAI(message);
    }
});

// Add message to chat
function addMessage(content, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `ai-message ${isUser ? 'ai-message-user' : 'ai-message-bot'}`;

    messageDiv.innerHTML = `
        <div class="ai-message-avatar">${isUser ? '👤' : '🤖'}</div>
        <div class="ai-message-content">${content}</div>
    `;

    aiChatMessages.appendChild(messageDiv);
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
}

// Show typing indicator
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'ai-message ai-message-bot';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `
        <div class="ai-message-avatar">🤖</div>
        <div class="ai-message-content">
            <div class="ai-typing">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;
    aiChatMessages.appendChild(typingDiv);
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
}

// Remove typing indicator
function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// Get user financial data for context
function getUserFinancialContext() {
    let context = {
        totalSpent: '₹0.00',
        remainingBudget: '₹0.00',
        savingsProgress: '0%',
        userType: 'professional'
    };

    try {
        const totalSpentEl = document.getElementById('totalSpent');
        const remainingBudgetEl = document.getElementById('remainingBudget');

        if (totalSpentEl) {
            context.totalSpent = totalSpentEl.textContent || '₹0.00';
        }

        if (remainingBudgetEl) {
            context.remainingBudget = remainingBudgetEl.textContent || '₹0.00';
        }

        // For demo/real users, get actual data
        if (isRealUser && currentUser) {
            context.userType = 'registered';
        }
    } catch (error) {
        console.error('Error getting financial context:', error);
    }

    return context;
}


// Send message to Gemini AI
async function sendMessageToAI(userMessage) {
    // Add user message to chat
    addMessage(userMessage, true);
    aiChatInput.value = '';
    aiSendBtn.disabled = true;

    // Show typing indicator
    showTypingIndicator();

    try {
        // Get user financial context safely
        const financialContext = getUserFinancialContext();

        // Create prompt
        const prompt = `You are B-Buddy AI, a friendly personal finance assistant.

User's Current Financial Status:
- Total Spent This Month: ${financialContext.totalSpent}
- Remaining Budget: ${financialContext.remainingBudget}

User Question: "${userMessage}"

Please provide helpful, personalized financial advice in 2-3 short paragraphs. Be encouraging and supportive. Use emojis to make it friendly.`;

        console.log('Sending request to Gemini API...');

        // Call Gemini API
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            })
        });

        console.log('Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', errorText);
            throw new Error(`API returned ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('API Response:', data);

        // Extract AI response
        if (!data.candidates || data.candidates.length === 0) {
            throw new Error('No response from AI');
        }

        const aiResponse = data.candidates[0].content.parts[0].text;

        // Remove typing indicator
        removeTypingIndicator();

        // Format and display response
        const formattedResponse = aiResponse.replace(/\n/g, '<br>');
        addMessage(formattedResponse, false);

    } catch (error) {
        console.error('AI Chat Error:', error);
        removeTypingIndicator();

        let errorMessage = '😔 Sorry, I encountered an error. ';

        if (error.message.includes('404')) {
            errorMessage += 'The AI model is not available. Please check the configuration.';
        } else if (error.message.includes('403')) {
            errorMessage += 'API key issue. Please verify your API key is valid.';
        } else if (error.message.includes('Failed to fetch')) {
            errorMessage += 'Network error. Please check your internet connection.';
        } else {
            errorMessage += 'Please try again later!';
        }

        addMessage(errorMessage, false);
    } finally {
        aiSendBtn.disabled = false;
        aiChatInput.focus();
    }
}