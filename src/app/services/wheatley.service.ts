import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, lastValueFrom } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { EnvironmentService } from './environment.service';

interface ApiResponse<T> {
    status: string;
    data: T;
    message?: string;
}

export interface Product {
    id: number;
    title: string;
    brand: string;
    image_url: string;
    final_price: number;
    initial_price: number;
    currency: string;
    categories?: string[];
    country_of_origin?: string;
    IsFavourite?: boolean;
    images?: string[] | string; // Can be array or string to parse
    discountPercentage?: number; // Added for convenience
}

export interface CurrencyRate {
    [key: string]: number;
}

@Injectable({
    providedIn: 'root'
})
export class WheatleyService {
    private studentnum: string = 'u14439141';
    private apiEndpoint: string = '';
    private currencyRates: CurrencyRate = {};

    // Add public theme-related properties
    public readonly THEME_COOKIE_NAME = 'theme';
    public readonly DEFAULT_THEME: 'light' | 'dark' = 'light';

    /**
     * The user's current type (customer, courier, etc.)
     * This is set upon successful login
     */
    public readonly USER_TYPE_COOKIE_NAME = 'userType';
    private userType: string = '';

    constructor(
        private http: HttpClient,
        private environmentService: EnvironmentService
    ) {
        this.initializeApiEndpoint();
        // Initialize user type from cookie on startup
        this.userType = this.getCookie(this.USER_TYPE_COOKIE_NAME) || '';
    }

    private initializeApiEndpoint(): void {
        this.environmentService.loadEnvConfig().subscribe({
            next: () => {
                this.apiEndpoint = this.environmentService.getWheatleyApiUrl();
                this.studentnum = this.environmentService.get('WHEATLEY_USER');
            },
            error: (error) => {
                console.error('Failed to load environment config:', error);
                // Fallback if environment loading fails
                this.apiEndpoint = 'https://wheatley.cs.up.ac.za/u14439141/api.php';
            }
        });
    }

    private getApiKey(): string {
        return this.getCookie('apikey') || '';
    }

    private getCookie(name: string): string {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
            return parts.pop()?.split(';').shift() || '';
        }
        return '';
    }

    private getPreferences(): any {
        const prefsStr = this.getCookie('preferences');
        return prefsStr ? JSON.parse(prefsStr) : {};
    }

    private getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': this.environmentService.getWheatleyAuthHeader()
        };
    }

    private buildRequestBody(type: string, additionalData: any = {}) {
        return {
            studentnum: this.studentnum,
            apikey: this.getApiKey(),
            wheatleyUser: this.environmentService.get('WHEATLEY_USER'),
            wheatleyPass: this.environmentService.get('WHEATLEY_PASS'),
            type: type,
            ...additionalData
        };
    }

    /**
     * Save user preferences to a cookie
     * @param preferences Object containing user preferences
     */
    savePreferences(preferences: {
        categories?: string;
        brand?: string;
        country_of_origin?: string;
        price_min?: number;
        price_max?: number;
        preferred_currency?: string;
    }): void {
        const existingPrefs = this.getPreferences();
        const updatedPrefs = { ...existingPrefs, ...preferences };
        document.cookie = `preferences=${JSON.stringify(updatedPrefs)}; max-age=${60 * 60 * 24 * 30}; path=/`;
    }

    /**
     * Calculate discount percentage for a product
     * @param product The product to calculate discount for
     * @returns The discount percentage
     */
    calculateDiscountPercentage(product: Product): number {
        if (product.initial_price && product.final_price && product.initial_price > product.final_price) {
            return parseFloat((((product.initial_price - product.final_price) / product.initial_price * 100)).toFixed(2));
        }
        return 0;
    }

    /**
     * Update product data with new currency values
     * @param products The products to update
     * @param targetCurrency The target currency to convert to
     * @returns Products with updated currency values
     */
    updateProductCurrency(products: Product[], targetCurrency: string): Observable<Product[]> {
        return this.getCurrencyRates().pipe(
            map(rates => {
                return products.map(product => {
                    const originalCurrency = product.currency;
                    const originalPrice = product.final_price;
                    const originalInitialPrice = product.initial_price;

                    const newFinalPrice = this.convertCurrency(originalPrice, originalCurrency, targetCurrency, rates);
                    const newInitialPrice = this.convertCurrency(originalInitialPrice, originalCurrency, targetCurrency, rates);

                    return {
                        ...product,
                        final_price: newFinalPrice,
                        initial_price: newInitialPrice,
                        currency: targetCurrency,
                        discountPercentage: this.calculateDiscountPercentage({
                            ...product,
                            final_price: newFinalPrice,
                            initial_price: newInitialPrice
                        })
                    };
                });
            })
        );
    }

    /**
     * Check if the user is currently logged in
     * @returns boolean indicating login status
     */
    isLoggedIn(): boolean {
        return !!this.getApiKey();
    }

    /**
     * Get the current user's type (customer, courier, distributor)
     * @returns The user's type or empty string if not logged in
     */
    getUserType(): string {
        // First try memory, then cookie
        if (!this.userType) {
            this.userType = this.getCookie(this.USER_TYPE_COOKIE_NAME) || '';
        }
        return this.userType;
    }

    /**
     * Set the user's type and store it in cookie
     * @param type The user's type to set
     */
    private setUserType(type: string): void {
        this.userType = type;
        // Store in cookie with 7-day expiry, similar to theme
        document.cookie = `${this.USER_TYPE_COOKIE_NAME}=${type}; max-age=${60 * 60 * 24 * 7}; path=/`;
    }

    /**
     * Get the current user's type from the server
     * @returns Observable<string> The user's type
     */
    private getCurrentUserType(): Observable<string> {
        const requestBody = this.buildRequestBody('GetCurrentUser', {
            return: ['type', 'user_type', 'role']
        });

        return this.http.post<ApiResponse<any>>(this.apiEndpoint, requestBody, {
            headers: this.getHeaders()
        }).pipe(
            map(response => {
                if (response.status === 'success' && response.data) {
                    // Try different possible field names for user type
                    const userType = response.data.type ||
                        response.data.user_type ||
                        response.data.role ||
                        response.data.user_role;
                    return userType || '';
                }
                return '';
            }),
            catchError(error => {
                console.error('Error getting user type:', error);
                return '';
            })
        );
    }

    // API methods
    login(email: string, password: string): Observable<ApiResponse<any>> {
        const requestBody = this.buildRequestBody('Login', {
            email: email,
            password: password,
            return: ['apikey', 'type', 'user_type', 'role'] // Request all possible user type fields
        });

        console.log('Sending login request with:', { email, requestBody });

        return this.http.post<ApiResponse<any>>(this.apiEndpoint, requestBody, {
            headers: this.getHeaders()
        }).pipe(
            map(response => {
                console.log('Login response:', response);
                if (response.status === 'success' && response.data) {
                    // Extract user type from response data, trying all possible field names
                    const userType =
                        response.data.type ||
                        response.data.user_type ||
                        response.data.userType ||
                        response.data.role ||
                        response.data.user_role;

                    if (userType) {
                        console.log('Setting user type:', userType);
                        this.setUserType(userType);
                    } else {
                        console.log('No user type in login response, fetching from server...');
                        // If no type in response, make a separate request to get user type
                        this.getCurrentUserType().subscribe({
                            next: (type) => {
                                if (type) {
                                    console.log('Retrieved user type:', type);
                                    this.setUserType(type);
                                } else {
                                    console.warn('Could not determine user type from server');
                                }
                            },
                            error: (error) => {
                                console.error('Error getting user type:', error);
                            }
                        });
                    }
                }
                return response;
            }),
            catchError(error => {
                console.error('Login error details:', error);
                if (error.status === 401) {
                    throw {
                        status: 'error',
                        message: 'Authentication failed. Please check your credentials or verify the API endpoint.',
                        data: null
                    };
                }
                throw error;
            })
        );
    }

    logout(): Observable<ApiResponse<any>> {
        // Clear user type from both memory and cookie
        this.userType = '';
        document.cookie = `${this.USER_TYPE_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;

        const requestBody = this.buildRequestBody('Logout');

        return this.http.post<ApiResponse<any>>(this.apiEndpoint, requestBody, {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    getCurrencyRates(): Observable<CurrencyRate> {
        const requestBody = this.buildRequestBody('GetCurrencyList');

        return this.http.post<ApiResponse<CurrencyRate>>(this.apiEndpoint, requestBody, {
            headers: this.getHeaders()
        }).pipe(
            map(response => {
                if (response.status === 'success') {
                    return response.data;
                } else {
                    throw new Error(response.message || 'Failed to fetch currency rates');
                }
            })
        );
    }

    convertCurrency(amount: number, fromCurrency: string, toCurrency: string, rates: CurrencyRate): number {
        if (rates[fromCurrency] && rates[toCurrency]) {
            const convertedAmount = (amount / rates[fromCurrency]) * rates[toCurrency];
            return parseFloat(convertedAmount.toFixed(2));
        } else {
            return amount;
        }
    }

    getDistinct(field: string): Observable<string[]> {
        // Special handling for categories which might be stored as JSON array
        const requestBody = this.buildRequestBody('GetDistinct', {
            limit: 100, // Increased limit for categories
            field: field,
            process_json: field === 'categories' // Tell backend to process JSON arrays for categories
        });

        console.log('Sending getDistinct request with:', {
            field: field,
            hasApiKey: !!this.getApiKey(),
            headers: this.getHeaders(),
            requestBody
        });

        return this.http.post<ApiResponse<string[]>>(this.apiEndpoint, requestBody, {
            headers: this.getHeaders()
        }).pipe(
            map(response => {
                if (response.status === 'success') {
                    let data = response.data;

                    // Special handling for categories
                    if (field === 'categories' && Array.isArray(data)) {
                        // Remove null/empty values and flatten any array values
                        data = data
                            .filter(cat => cat) // Remove null/undefined
                            .map(cat => {
                                // If the category is stored as a JSON string, parse it
                                if (typeof cat === 'string' && cat.startsWith('[')) {
                                    try {
                                        return JSON.parse(cat);
                                    } catch (e) {
                                        console.error('Error parsing category JSON:', e);
                                        return cat;
                                    }
                                }
                                return cat;
                            })
                            .flat() // Flatten arrays
                            .filter((cat, index, self) =>
                                cat && // Remove empty values
                                self.indexOf(cat) === index); // Remove duplicates
                    }

                    console.log(`Processed ${field} data:`, data);
                    return data;
                } else {
                    console.error(`Failed to fetch distinct ${field}:`, response);
                    throw new Error(response.message || `Failed to fetch distinct ${field}`);
                }
            }),
            catchError(error => {
                console.error(`getDistinct error for ${field}:`, error);
                if (error.status === 401) {
                    // Clear credentials and notify user
                    this.setUserType('');
                    document.cookie = 'apikey=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                    throw new Error('Your session has expired. Please log in again.');
                }
                throw error;
            })
        );
    }

    getAllProducts(params: {
        searchTerm?: string,
        category?: string,
        brand?: string,
        minPrice?: number,
        maxPrice?: number,
        country?: string,
        sortOrder?: string,
        preferredCurrency?: string
    }): Observable<Product[]> {
        // Create search object with proper handling of empty/null values
        const search: Record<string, any> = {};

        if (params.searchTerm) {
            search['title'] = params.searchTerm;
        }

        if (params.brand && params.brand !== 'all') {
            search['brand'] = params.brand;
        }

        if (params.category && params.category !== 'all') {
            search['categories'] = params.category;
        }

        if (params.country && params.country !== 'all') {
            search['country_of_origin'] = params.country;
        }

        if (params.minPrice) {
            search['price_min'] = params.minPrice;
        }

        if (params.maxPrice) {
            search['price_max'] = params.maxPrice;
        }

        const requestBody = this.buildRequestBody('GetAllProducts', {
            sort: 'final_price',
            order: params.sortOrder === 'highestprice' ? 'DESC' : 'ASC',
            return: '*',
            limit: 60,
            preferred_currency: params.preferredCurrency || '',
            search: search
        });

        console.log('Sending getAllProducts request with:', {
            hasApiKey: !!this.getApiKey(),
            headers: this.getHeaders(),
            userType: this.getUserType(),
            requestBody: requestBody
        });

        return this.http.post<ApiResponse<Product[]>>(this.apiEndpoint, requestBody, {
            headers: this.getHeaders()
        }).pipe(
            map(response => {
                console.log('GetAllProducts response:', response);
                if (response.status === 'success' && Array.isArray(response.data)) {
                    return response.data.map(product => {
                        const processedProduct: Product = {
                            ...product,
                            categories: [],
                            images: [],
                            // Ensure all required Product properties are set
                            id: product.id,
                            title: product.title,
                            brand: product.brand,
                            image_url: product.image_url || '',
                            final_price: product.final_price,
                            initial_price: product.initial_price,
                            currency: product.currency
                        };

                        // Process categories
                        if (product.categories) {
                            if (typeof product.categories === 'string') {
                                try {
                                    const parsed = JSON.parse(product.categories);
                                    processedProduct.categories = Array.isArray(parsed) ?
                                        parsed.filter(Boolean).map(String) :
                                        [product.categories];
                                } catch (e) {
                                    processedProduct.categories = [product.categories];
                                }
                            } else if (Array.isArray(product.categories)) {
                                processedProduct.categories = product.categories
                                    .filter(Boolean)
                                    .map(String);
                            }
                        }

                        // Process images
                        if (product.images) {
                            if (typeof product.images === 'string') {
                                try {
                                    const parsed = JSON.parse(product.images);
                                    processedProduct.images = Array.isArray(parsed) ? parsed : [product.images];
                                    if (!processedProduct.image_url && processedProduct.images.length > 0) {
                                        processedProduct.image_url = processedProduct.images[0];
                                    }
                                } catch (e) {
                                    processedProduct.images = [product.images];
                                    if (!processedProduct.image_url) {
                                        processedProduct.image_url = product.images;
                                    }
                                }
                            } else if (Array.isArray(product.images)) {
                                processedProduct.images = product.images;
                                if (!processedProduct.image_url && product.images.length > 0) {
                                    processedProduct.image_url = product.images[0];
                                }
                            }
                        }

                        return processedProduct;
                    });
                } else {
                    console.error('Products request failed:', response);
                    throw new Error(response.message || 'Failed to fetch products');
                }
            }),
            catchError(error => {
                console.error('Products request error:', error);
                if (error.status === 401) {
                    this.setUserType('');
                    document.cookie = 'apikey=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                    throw new Error('Your session has expired. Please log in again.');
                }
                throw error;
            })
        );
    }

    getDeals(preferredCurrency?: string): Observable<Product[]> {
        const requestBody = this.buildRequestBody('GetAllProducts', {
            sort: 'title',
            order: 'ASC',
            return: '*',
            preferred_currency: preferredCurrency || '',
            limit: 60
        });

        return this.http.post<ApiResponse<Product[]>>(this.apiEndpoint, requestBody, {
            headers: this.getHeaders()
        }).pipe(
            map(response => {
                if (response.status === 'success') {
                    // Filter products with at least 10% discount
                    return response.data.filter(product => {
                        const discountPercentage = ((product.initial_price - product.final_price) / product.initial_price * 100);
                        return discountPercentage >= 10;
                    });
                } else {
                    throw new Error(response.message || 'Failed to fetch deals');
                }
            })
        );
    }

    toggleWishlist(productId: number): Observable<ApiResponse<any>> {
        const requestBody = {
            studentnum: this.studentnum,
            apikey: this.getApiKey(),
            type: 'Wishlist',
            product_id: productId
        };

        return this.http.post<ApiResponse<any>>(this.apiEndpoint, requestBody, {
            headers: this.getHeaders()
        });
    }

    getWishlistItems(): Observable<Product[]> {
        const requestBody = {
            studentnum: this.studentnum,
            apikey: this.getApiKey(),
            type: "GetAllProductsWishlist",
            return: "*",
            limit: 60
        };

        console.log('Sending wishlist request with:', { studentNum: this.studentnum, hasApiKey: !!this.getApiKey() });

        return this.http.post<ApiResponse<Product[]>>(this.apiEndpoint, requestBody, {
            headers: this.getHeaders()
        }).pipe(
            map(response => {
                console.log('Wishlist API response:', response);
                if (response.status === 'success') {
                    // Process the data to ensure image_url is properly set
                    return response.data.map(product => {
                        // Check if images is a string that needs parsing
                        if (product.images && typeof product.images === 'string' && !product.image_url) {
                            try {
                                const imagesArray = JSON.parse(product.images);
                                product.image_url = imagesArray[0]; // Use first image as image_url
                            } catch (e) {
                                console.error('Error parsing product images:', e);
                            }
                        }
                        return product;
                    });
                } else {
                    throw new Error(response.message || 'Failed to fetch wishlist items');
                }
            })
        );
    }

    addToCart(productId: number, quantity: number = 1): Observable<ApiResponse<any>> {
        const requestBody = {
            studentnum: this.studentnum,
            apikey: this.getApiKey(),
            type: 'Cart',
            action: 'add',
            product_id: productId,
            quantity: quantity
        };

        return this.http.post<ApiResponse<any>>(this.apiEndpoint, requestBody, {
            headers: this.getHeaders()
        });
    }

    getCart(): Observable<any[]> {
        const requestBody = {
            studentnum: this.studentnum,
            apikey: this.getApiKey(),
            type: 'Cart',
            action: 'list',
            return: '*'
        };

        console.log('Sending cart request with:', { studentNum: this.studentnum, hasApiKey: !!this.getApiKey() });

        return this.http.post<ApiResponse<any[]>>(this.apiEndpoint, requestBody, {
            headers: this.getHeaders()
        }).pipe(
            map(response => {
                if (response.status === 'success') {
                    return response.data || [];
                } else {
                    throw new Error(response.message || 'Failed to fetch cart items');
                }
            })
        );
    }

    updateCartQuantity(productId: number, quantity: number): Observable<ApiResponse<any>> {
        const requestBody = {
            studentnum: this.studentnum,
            apikey: this.getApiKey(),
            type: 'Cart',
            action: 'update',
            product_id: productId,
            quantity: quantity
        };

        return this.http.post<ApiResponse<any>>(this.apiEndpoint, requestBody, {
            headers: this.getHeaders()
        });
    }

    removeFromCart(productId: number): Observable<ApiResponse<any>> {
        const requestBody = {
            studentnum: this.studentnum,
            apikey: this.getApiKey(),
            type: 'Cart',
            action: 'remove',
            product_id: productId
        };

        return this.http.post<ApiResponse<any>>(this.apiEndpoint, requestBody, {
            headers: this.getHeaders()
        });
    }

    createOrder(): Observable<ApiResponse<any>> {
        const requestBody = this.buildRequestBody('CreateOrder');

        return this.http.post<ApiResponse<any>>(this.apiEndpoint, requestBody, {
            headers: this.getHeaders()
        });
    }

    getOrderDetails(orderId: number): Observable<ApiResponse<any>> {
        const requestBody = this.buildRequestBody('GetOrderDetails', {
            order_id: orderId
        });

        return this.http.post<ApiResponse<any>>(this.apiEndpoint, requestBody, {
            headers: this.getHeaders()
        });
    }

    getOrders(): Observable<ApiResponse<any>> {
        const requestBody = this.buildRequestBody('GetOrders');

        return this.http.post<ApiResponse<any>>(this.apiEndpoint, requestBody, {
            headers: this.getHeaders()
        });
    }

    requestDelivery(orderId: number, productId: number): Observable<ApiResponse<any>> {
        const requestBody = this.buildRequestBody('RequestDelivery', {
            order_id: orderId,
            product_id: productId
        });
        return this.http.post<ApiResponse<any>>(this.apiEndpoint, requestBody, {
            headers: this.getHeaders()
        });
    }

    getProduct(productId: number): Observable<ApiResponse<Product>> {
        const requestBody = this.buildRequestBody('GetProduct', {
            product_id: productId
        });
        return this.http.post<ApiResponse<Product>>(this.apiEndpoint, requestBody, {
            headers: this.getHeaders()
        });
    }

    // Get delivery coordinates for an order
    getDeliveryCoordinates(orderId: number): Observable<ApiResponse<{ lat: number, lng: number }>> {
        const requestBody = this.buildRequestBody('GetDeliveryCoordinates', {
            order_id: orderId
        });

        return this.http.post<ApiResponse<{ lat: number, lng: number }>>(this.apiEndpoint, requestBody, {
            headers: this.getHeaders()
        });
    }

    getPendingDeliveries() {
        return this.http.get<any>(`${this.apiEndpoint}/deliveries/pending`, {
            headers: this.getHeaders()
        });
    }

    /**
     * Set the theme for the application (light or dark)
     * @param theme The theme to set ('light' or 'dark')
     */
    setTheme(theme: 'light' | 'dark'): void {
        document.body.classList.remove('light', 'dark');
        document.body.classList.add(theme);

        // Set cookie
        document.cookie = `${this.THEME_COOKIE_NAME}=${theme}; max-age=${60 * 60 * 24 * 7}; path=/`;
    }

    /**
     * Get the current theme from the cookie
     * @returns The current theme ('light' or 'dark')
     */
    getTheme(): 'light' | 'dark' {
        return (this.getCookie(this.THEME_COOKIE_NAME) || this.DEFAULT_THEME) as 'light' | 'dark';
    }
}
