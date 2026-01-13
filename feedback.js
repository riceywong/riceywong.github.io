// Feedback Form JavaScript
// Handles form validation, sanitization, image upload, and Supabase integration

// Initialize Supabase client
let supabase;
try {
	if (typeof SUPABASE_CONFIG !== 'undefined') {
		supabase = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
	} else {
		console.error('Supabase configuration not found. Please create config.js with SUPABASE_CONFIG.');
	}
} catch (error) {
	console.error('Error initializing Supabase:', error);
}

// Constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic'];
const RATE_LIMIT_SECONDS = 60;
const STORAGE_BUCKET = 'feedback-images';

// DOM Elements
const form = document.getElementById('feedback-form');
const emailInput = document.getElementById('email');
const issueInput = document.getElementById('issue');
const imageInput = document.getElementById('image');
const submitBtn = document.getElementById('submit-btn');
const submitText = document.getElementById('submit-text');
const submitSpinner = document.getElementById('submit-spinner');
const charCounter = document.getElementById('char-counter');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const imageName = document.getElementById('image-name');
const imageSize = document.getElementById('image-size');
const removeImageBtn = document.getElementById('remove-image');
const uploadProgress = document.getElementById('upload-progress');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const formContainer = document.getElementById('feedback-form-container');
const thankYouContainer = document.getElementById('thank-you-container');
const generalError = document.getElementById('general-error');

// State
let selectedFile = null;
let isSubmitting = false;
let convertedFile = null;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
	initializeForm();
});

function initializeForm() {
	// Character counter
	updateCharCounter();
	issueInput.addEventListener('input', updateCharCounter);
	
	// Email validation on blur
	emailInput.addEventListener('blur', validateEmail);
	emailInput.addEventListener('input', clearError.bind(null, 'email'));
	
	// Issue validation on blur
	issueInput.addEventListener('blur', validateIssue);
	issueInput.addEventListener('input', function() {
		updateCharCounter();
		clearError('issue');
	});
	
	// Image selection
	imageInput.addEventListener('change', handleImageSelect);
	
	// Remove image button
	removeImageBtn.addEventListener('click', removeImage);
	
	// Form submission
	form.addEventListener('submit', handleSubmit);
	
	// Prevent form submission on Enter in textarea (allow Shift+Enter for new lines)
	issueInput.addEventListener('keydown', function(e) {
		if (e.key === 'Enter' && !e.shiftKey && issueInput.value.length >= 500) {
			e.preventDefault();
		}
	});
}

// Character Counter
function updateCharCounter() {
	const length = issueInput.value.length;
	const maxLength = 500;
	charCounter.textContent = `${length}/${maxLength}`;
	
	// Update color based on length
	charCounter.classList.remove('warning', 'error');
	if (length >= 480) {
		charCounter.classList.add('error');
	} else if (length >= 400) {
		charCounter.classList.add('warning');
	}
	
	// Disable input at limit
	if (length >= maxLength) {
		issueInput.style.overflow = 'hidden';
	}
}

// Email Validation
function validateEmail() {
	const email = emailInput.value.trim().toLowerCase();
	const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
	
	if (!email) {
		showError('email', 'Email is required');
		emailInput.setAttribute('aria-invalid', 'true');
		return false;
	}
	
	if (!emailRegex.test(email)) {
		showError('email', 'Please enter a valid email address');
		emailInput.setAttribute('aria-invalid', 'true');
		return false;
	}
	
	clearError('email');
	emailInput.setAttribute('aria-invalid', 'false');
	return true;
}

// Issue Validation
function validateIssue() {
	const issue = issueInput.value.trim();
	
	if (!issue) {
		showError('issue', 'Issue description is required');
		issueInput.setAttribute('aria-invalid', 'true');
		return false;
	}
	
	if (issue.length > 500) {
		showError('issue', 'Issue description must be 500 characters or less');
		issueInput.setAttribute('aria-invalid', 'true');
		return false;
	}
	
	clearError('issue');
	issueInput.setAttribute('aria-invalid', 'false');
	return true;
}

// Image Selection Handler
async function handleImageSelect(event) {
	const file = event.target.files[0];
	if (!file) return;
	
	// Clear previous errors
	clearError('image');
	
	// Validate file type
	const fileType = file.type.toLowerCase();
	const fileName = file.name.toLowerCase();
	const isValidType = ALLOWED_FILE_TYPES.some(type => 
		fileType === type || fileName.endsWith(type.split('/')[1])
	);
	
	if (!isValidType) {
		showError('image', 'Please select a jpg, jpeg, png, or heic image');
		imageInput.value = '';
		return;
	}
	
	// Validate file size
	if (file.size > MAX_FILE_SIZE) {
		showError('image', 'Image must be 5MB or smaller');
		imageInput.value = '';
		return;
	}
	
	selectedFile = file;
	
	// Handle HEIC conversion
	if (fileType === 'image/heic' || fileName.endsWith('.heic')) {
		try {
			showUploadProgress(0, 'Converting HEIC to JPEG...');
			convertedFile = await convertHEICtoJPEG(file);
			showImagePreview(convertedFile);
		} catch (error) {
			console.error('HEIC conversion error:', error);
			showError('image', 'Failed to convert HEIC image. Please try a different format.');
			imageInput.value = '';
			selectedFile = null;
			convertedFile = null;
		}
	} else {
		convertedFile = null;
		showImagePreview(file);
	}
}

// HEIC to JPEG Conversion
async function convertHEICtoJPEG(file) {
	return new Promise((resolve, reject) => {
		if (typeof heic2any === 'undefined') {
			reject(new Error('HEIC conversion library not loaded'));
			return;
		}
		
		heic2any({
			blob: file,
			toType: 'image/jpeg',
			quality: 0.9
		}).then(conversionResult => {
			// heic2any returns an array, get the first blob
			const jpegBlob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
			resolve(jpegBlob);
		}).catch(reject);
	});
}

// Show Image Preview
function showImagePreview(file) {
	const reader = new FileReader();
	reader.onload = function(e) {
		imagePreview.src = e.target.result;
		imagePreviewContainer.style.display = 'block';
		imageName.textContent = file.name;
		imageSize.textContent = formatFileSize(file.size);
	};
	reader.readAsDataURL(file);
	uploadProgress.style.display = 'none';
}

// Remove Image
function removeImage() {
	selectedFile = null;
	convertedFile = null;
	imageInput.value = '';
	imagePreviewContainer.style.display = 'none';
	uploadProgress.style.display = 'none';
	clearError('image');
}

// Format File Size
function formatFileSize(bytes) {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Show Upload Progress
function showUploadProgress(percent, text) {
	uploadProgress.style.display = 'block';
	progressFill.style.width = percent + '%';
	progressText.textContent = text || percent + '%';
}

// Error Handling
function showError(fieldId, message) {
	const errorElement = document.getElementById(fieldId + '-error');
	if (errorElement) {
		errorElement.textContent = message;
		errorElement.style.display = 'block';
	}
}

function clearError(fieldId) {
	const errorElement = document.getElementById(fieldId + '-error');
	if (errorElement) {
		errorElement.textContent = '';
		errorElement.style.display = 'none';
	}
	
	const input = document.getElementById(fieldId);
	if (input) {
		input.setAttribute('aria-invalid', 'false');
	}
}

function showGeneralError(message) {
	generalError.textContent = message;
	generalError.style.display = 'block';
	generalError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearGeneralError() {
	generalError.textContent = '';
	generalError.style.display = 'none';
}

// Rate Limiting
function checkRateLimit() {
	const lastSubmission = localStorage.getItem('feedback_last_submission');
	if (!lastSubmission) return true;
	
	const now = Date.now();
	const timeSinceLastSubmission = (now - parseInt(lastSubmission)) / 1000;
	
	if (timeSinceLastSubmission < RATE_LIMIT_SECONDS) {
		const remaining = Math.ceil(RATE_LIMIT_SECONDS - timeSinceLastSubmission);
		showGeneralError(`Please wait ${remaining} second${remaining > 1 ? 's' : ''} before submitting again.`);
		return false;
	}
	
	return true;
}

function setRateLimit() {
	localStorage.setItem('feedback_last_submission', Date.now().toString());
}

// Honeypot Check
function checkHoneypot() {
	const honeypot = form.querySelector('input[name="website"]');
	if (honeypot && honeypot.value.trim() !== '') {
		console.warn('Honeypot field filled - potential bot submission');
		return false;
	}
	return true;
}

// Sanitize Input
function sanitizeEmail(email) {
	return email.trim().toLowerCase();
}

function sanitizeIssue(issue) {
	// Use DOMPurify to strip HTML and sanitize
	if (typeof DOMPurify !== 'undefined') {
		return DOMPurify.sanitize(issue.trim(), { ALLOWED_TAGS: [] });
	}
	// Fallback: basic HTML stripping
	return issue.trim().replace(/<[^>]*>/g, '');
}

// Collect Metadata
function collectMetadata() {
	return {
		user_agent: navigator.userAgent,
		referrer_url: document.referrer || null,
		page_url: window.location.href,
		language: navigator.language || null,
		screen_resolution: `${screen.width}x${screen.height}`
	};
}

// Upload Image to Supabase Storage
async function uploadImage(file) {
	if (!supabase) {
		throw new Error('Supabase client not initialized');
	}
	
	const timestamp = Math.floor(Date.now() / 1000);
	const uuid = crypto.randomUUID ? crypto.randomUUID() : generateUUID();
	const extension = file.type.split('/')[1] || 'jpg';
	const fileName = `${timestamp}-${uuid}.${extension}`;
	
	try {
		showUploadProgress(0, 'Uploading image...');
		
		const { data, error } = await supabase.storage
			.from(STORAGE_BUCKET)
			.upload(fileName, file, {
				cacheControl: '3600',
				upsert: false,
				onUploadProgress: (progress) => {
					const percent = Math.round((progress.loaded / progress.total) * 100);
					showUploadProgress(percent, `${percent}%`);
				}
			});
		
		if (error) throw error;
		
		// Get public URL (or signed URL for private bucket)
		const { data: urlData } = supabase.storage
			.from(STORAGE_BUCKET)
			.getPublicUrl(fileName);
		
		showUploadProgress(100, 'Upload complete');
		return urlData.publicUrl;
		
	} catch (error) {
		console.error('Image upload error:', error);
		throw new Error('Failed to upload image. Please try again.');
	}
}

// Generate UUID (fallback for older browsers)
function generateUUID() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		const r = Math.random() * 16 | 0;
		const v = c === 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}

// Submit Form Data to Supabase
async function submitFormData(email, issue, imageUrl, metadata) {
	if (!supabase) {
		throw new Error('Supabase client not initialized');
	}
	
	const { data, error } = await supabase
		.from('feedback_submissions')
		.insert([
			{
				email: email,
				issue: issue,
				image_url: imageUrl || null,
				user_agent: metadata.user_agent,
				referrer_url: metadata.referrer_url,
				page_url: metadata.page_url,
				language: metadata.language,
				screen_resolution: metadata.screen_resolution
			}
		])
		.select();
	
	if (error) throw error;
	return data;
}

// Form Submission Handler
async function handleSubmit(event) {
	event.preventDefault();
	
	// Prevent double submission
	if (isSubmitting) return;
	
	// Clear previous errors
	clearGeneralError();
	
	// Validate all fields
	const isEmailValid = validateEmail();
	const isIssueValid = validateIssue();
	
	if (!isEmailValid || !isIssueValid) {
		showGeneralError('Please fix the errors above before submitting.');
		return;
	}
	
	// Check honeypot
	if (!checkHoneypot()) {
		showGeneralError('Invalid submission detected.');
		return;
	}
	
	// Check rate limit
	if (!checkRateLimit()) {
		return;
	}
	
	// Set submitting state
	isSubmitting = true;
	submitBtn.disabled = true;
	submitText.textContent = 'submitting...';
	submitSpinner.style.display = 'inline-flex';
	
	try {
		// Sanitize inputs
		const email = sanitizeEmail(emailInput.value);
		const issue = sanitizeIssue(issueInput.value);
		
		// Collect metadata
		const metadata = collectMetadata();
		
		// Upload image if provided
		let imageUrl = null;
		const fileToUpload = convertedFile || selectedFile;
		if (fileToUpload) {
			try {
				imageUrl = await uploadImage(fileToUpload);
			} catch (error) {
				console.error('Image upload failed:', error);
				throw new Error('Image upload failed. Please try again without the image or use a smaller file.');
			}
		}
		
		// Submit form data
		await submitFormData(email, issue, imageUrl, metadata);
		
		// Set rate limit
		setRateLimit();
		
		// Track in Google Analytics if available
		if (typeof ga !== 'undefined') {
			ga('send', 'event', 'Feedback', 'Submit', 'Success');
		}
		
		// Show thank you message
		showThankYou();
		
	} catch (error) {
		console.error('Form submission error:', error);
		
		// Show user-friendly error message
		let errorMessage = 'An error occurred. Please try again later.';
		
		if (error.message) {
			errorMessage = error.message;
		} else if (error.code === 'PGRST116') {
			errorMessage = 'Unable to connect to server. Please check your internet connection.';
		} else if (error.code === '23505') {
			errorMessage = 'This submission already exists.';
		}
		
		showGeneralError(errorMessage);
		
		// Track error in Google Analytics if available
		if (typeof ga !== 'undefined') {
			ga('send', 'event', 'Feedback', 'Submit', 'Error', error.code || 'Unknown');
		}
		
	} finally {
		// Reset submitting state
		isSubmitting = false;
		submitBtn.disabled = false;
		submitText.textContent = 'submit';
		submitSpinner.style.display = 'none';
		uploadProgress.style.display = 'none';
	}
}

// Show Thank You Message
function showThankYou() {
	// Fade out form
	formContainer.classList.add('fade-out');
	
	setTimeout(() => {
		formContainer.style.display = 'none';
		thankYouContainer.style.display = 'block';
		
		// Reset form
		resetForm();
	}, 300);
}

// Reset Form
function resetForm() {
	form.reset();
	selectedFile = null;
	convertedFile = null;
	imagePreviewContainer.style.display = 'none';
	uploadProgress.style.display = 'none';
	updateCharCounter();
	clearGeneralError();
	clearError('email');
	clearError('issue');
	clearError('image');
	emailInput.setAttribute('aria-invalid', 'false');
	issueInput.setAttribute('aria-invalid', 'false');
}

