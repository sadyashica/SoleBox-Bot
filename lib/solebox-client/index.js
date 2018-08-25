// # Solebox Client
// mimics the solebox web client and adds functions to help checking out
'use strict';

const request = require('request-promise');
const logger = require('../logger');
const cheerio = require('cheerio');
const debug = require('debug');

class SoleboxClient {
  constructor(options) {
    // set up user options
    this._customer = options.customer;
    this._product = options.product;
    this._proxy = options.proxy;

    // set up cookie jar and request instance
    this._jar = request.jar();
    this._userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_0_2 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) Mobile/14A456';
    this._request = request.defaults({ jar: this._jar });

    // set up logging
    this._debug = debug(this._customer.email);
    this._log = logger(this._customer.email);

    this._fetched = {};
  }

  async buyProduct() {
    try {
    // wait for user to have logged in
    await this.login();

    // loading the product details
    await this.getProductDetails();

    // add product to cart
    await this.addToCart();
    } catch (err) {
      this._log.red(err);
    }
  }

  async login() {
    // prepare request options
    let options = {
      uri: 'https://www.solebox.com/index.php',
      method: 'POST',
      form: {
        lang: 0,
        listtype: null,
        actcontrol: 'account',
        fnc: 'login_noredirect',
        cl: 'account',
        tpl: null,
        oxloadid: null,
        lgn_usr: this._customer.email,
        lgn_pwd: this._customer.password
      }
    };

    // make login request
    let response = await this._makeRequest(options);

    // check if the login was successful
    if (response.indexOf('dashboardLogout') == -1) {
      // the login was not successful
      throw new Error('username or password wrong. login was not successful'); 
    }

    // successfully logged in user
    return this._log.green('successfully logged in ' + this._customer.email);
  }

  async getProductDetails() { 
    // prepare request options
    let options = {
      uri: this._product.url,
      method: 'GET',
    };

    // make the request
    let body = await this._makeRequest(options);

    // load cheerio body
    let $ = cheerio.load(body);

    // get product anid and cnid
    const anid = $('input[name="anid"]').val();
    const cnid = $('input[name="cnid"]').val();

    // get product variants
    let sizes = {};
    let inStockCount = 0;
    $('a.selectSize').each(function() {
      const id = $(this).attr('id');
      const size = $(this).data('size-us');
      const inStock = $(this).parent().attr('class').indexOf('inactive') === -1;
      if (inStock) inStockCount++;
      sizes[size] = {
        inStock: inStock,
        id
      };
    });

    // log sizes in stock
    this._log.normal(`${inStockCount} sizes in stock for product ${anid}`);

    // save product details
    this._fetched.product = {
      anid,
      cnid,
      sizes
    };
    return this._fetched.product;
  }
 
  async addToCart() {
    // check for product details
    const SIZE = this._product.size;
    if (!this._fetched.product || !this._fetched.product.cnid || !this._fetched.product.anid || !this._fetched.product.sizes || !this._fetched.product.sizes[SIZE]) throw new Error('make sure to call getProductDetails() before adding a product to cart');

    // check if the size is out of stock
    if (!this._fetched.product.sizes[SIZE].inStock) throw new Error(`the selected size ${SIZE} is currently out of stock.`);

    // prepare request options
    let options = {
      uri: 'https://www.solebox.com/index.php',
      method: 'POST',
      form: {
        lang: 0,
        cnid: this._fetched.product.cnid,
        lisstype: 'list',
        actcontrol: 'details',
        cl: 'details',
        aid: this._fetched.product.sizes[SIZE].id,
        anid: this._fetched.product.anid,
        parentid: this._fetched.product.anid,
        panid: null,
        fnc: 'tobasket',
        am: 1
      },
      simple: false,
      resolveWithFullResponse: true
    };

    // make add to cart request
    let response = await this._makeRequest(options);

    // check location header
    if (response.statusCode !== 302 || response.headers.location !== `https://www.solebox.com/index.php?cl=details&cnid=${this._fetched.product.cnid}&anid=${this._fetched.product.anid}&`) throw new Error('there was an error trying to add the product to cart');
  }

  async _makeRequest(options) {
    // set defaults
    options.method = options.method || 'GET';
    // prepare headers
    let headers = {
      'User-Agent': this._userAgent,
      'Accept-Encoding': 'deflate, br',
      'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8'
    };
    
    // add custom headers
    if (options.headers) {
      // # custom headers have been specified
      // add to headers object
      for (const key of Object.keys(options.headers)) {
        headers[key] = options.headers[key];
      }
    }

    // prepare http options
    let settings = {
      ...options,
      proxy: this._proxy,
      uri: options.uri,
      method: options.method,
      json: options.json,
      headers
    };

    // add form if present
    if (options.form) settings.form = options.form;

    // # make actual request
    return await this._request(settings);
  }
}

// # export for use elsewhere
module.exports = SoleboxClient;