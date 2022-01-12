const axios = require('axios');
const FormData = require('form-data');
const parse = require('csv-parse/lib/sync');

const neolysURL = "https://neolysys.fr/";
const searchOrderExport = 'search_order_export';

class Neolys {
    constructor(credentials) {
        this.username = credentials.username;
        this.password = credentials.password;
        this.sessionId = '';
    }

    setSessionId = (id) => {
        this.sessionId = id;
    }

    authenticate = () => {
        return new Promise((resolve, reject) => {
            let data = new FormData();
            data.append('log', this.username);
            data.append('Pass', this.password);

            axios({
                    method: 'post',
                    url: `${neolysURL}/sommaire.php`,
                    data: data,
                    headers: {
                        ...data.getHeaders()
                    },
                    withCredentials: true
                })
                .then(function (response) {
                    if (response.data.includes('submitbtn')) {
                        // console.log("not logged in");
                        reject(Error('unauthorized'));
                        return;
                    }
                    else {
                        // console.log("response.headers", response.headers['set-cookie']);
                        const authCookie = response.headers['set-cookie'];
                        // console.log("authCookie", authCookie);
                        resolve(authCookie[authCookie.length-1].split(';')[0]);
                        return;
                    }
                })
                .catch(function (response) {
                    console.error(response);
                    reject(response);
                    return;
                });
        });
    }

    methodCall = ({method, params, columns}) => {
        return new Promise((resolve, reject) => {
            let data = new FormData();
            for (const [key, value] of Object.entries(params)) {
                data.append(key, value);
            }
            console.log("this.sessionId", this.sessionId);

            axios({
                method: 'post',
                url: `${neolysURL}/${method}.php`,
                data: data,
                headers: {
                    Cookie: this.sessionId,
                    ...data.getHeaders()
                }
            })
            .then(function (response) {
                if (response.data.includes('submitbtn')) {
                    console.log("not logged in");
                    reject(Error('unauthorized'));
                    return;
                }
                else {
                  // console.log('response.data', response.data);
                    const records = parse(response.data, {
                        delimiter: ';',
                        relax: true,
                        trim: true,
                        columns: columns || true,
                        skip_empty_lines: true
                    });
                    
                    resolve(records)
                    return;
                }
            })
            .catch(function (response) {
                console.log(response);
                reject(response);
            });
        })
    }

    api = ({method= '', params= {}, columns=true} = {}) => {
        return new Promise((resolve, reject) => {
            
            if (this.sessionId) {
                this.methodCall({method, params, columns})
                .catch(e => {
                    console.log("error", e.message);
                    if (e.message == 'unauthorized') {
                        // login and try again
                        this.authenticate().then(r => {
                            this.setSessionId(r);
                            this.methodCall({method, params, columns})
                            .then(r => resolve(r));
                        })
                    }
                })
            }
            else {
                // login first
                this.authenticate().then(r => {
                    this.setSessionId(r);
                    this.methodCall({method, params, columns})
                    .then(r => resolve(r))
                    .catch(e => {
                        console.log("after auth", e.message);
                    });
                })
            }
        });
    }

  getOrders = (params) => {
      const columns = ['corp', 'unit', 'order_id', 'created_at', 'company', 'shipping_last_name', 'shipping_first_name', 'email', 'carrier_code', '_2', 'processed_at', '_4', 'carrier', 'carrier_parcel_id', 'zip', 'country_code', 'weight'];
      return this.api({
        method: 'search_order_export',
        params,
        columns
      });
    }
}

module.exports = Neolys;