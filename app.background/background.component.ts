/// <reference path="../typings/globals/chrome/index.d.ts"/>

import { Component, OnInit, OnDestroy } from '@angular/core';
import { HTTP_PROVIDERS, Http } from '@angular/http';
import { Observable } from 'rxjs/Rx';

import { VKConsts } from '../app/vk-consts';

import { AuthHelper } from './auth-helper';
import { VKService } from './vk-service';
import { UserService } from './user-service';
import { DialogService } from './dialogs-service';
import { Channels } from './channels';

@Component({
    selector: 'background-app',
    template: '<span>Backgrounf component</span>',
    providers: [HTTP_PROVIDERS, VKService, DialogService, UserService],
    precompile: []
})
export class BackgroundComponent implements OnInit, OnDestroy {
    i: number = 0;

    constructor(
        private http: Http,
        private dialogsService: DialogService,
        private userService: UserService) { }

    ngOnInit() {
        console.log('background init');
        AuthHelper.addTabListener();
        this.preAuthorize();
        //Observable.interval(1000).subscribe(r => {this.i++; chrome.browserAction.setBadgeText({text: String(this.i)});});

        chrome.runtime.onConnect.addListener(port => {
            if (port.name === Channels.messages_cache_port) {
                this.initMessagesCache(port);
            }
            else {
                console.log('unknown port: ' + port.name);
            }
        });

        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            switch (request.name) {
                case Channels.get_dialogs_request: 
                    this.dialogsService.getCachedDialogs().subscribe(dialogs => {
                        sendResponse({data: dialogs});
                        console.log('dialogs sent');
                    });
                    break;
                case Channels.get_history_request:
                    this.dialogsService.getHistory(request.conversation_id, request.is_chat).subscribe(history => {
                        sendResponse({data: history});
                        console.log('history sent');
                    });
                    break;
                case Channels.get_chat_participants_request:
                    this.dialogsService.getChatParticipants(request.chat_id).subscribe(participants => {
                        sendResponse({data: participants})
                        console.log('chat participants sent')
                    });
                    break;
                case Channels.get_message_request:
                    this.dialogsService.getMessage(request.message_ids).subscribe(messages => {
                        sendResponse({data: messages})
                        console.log('messages sent')
                    });
                    break;
                case Channels.send_message_request:
                    this.dialogsService.sendMessage(request.user_id, request.message_body, request.is_chat).subscribe(message => {
                        sendResponse({data: message})
                        console.log('message id sent')
                    });
                    break;
                case Channels.get_multiple_users_request:
                    this.userService.getUsers(request.user_ids).subscribe(users => {
                        sendResponse({data: users})
                        console.log('users sent')
                    });
                    break;
                case Channels.get_user_request:
                    this.userService.getUser(request.user_id).subscribe(user => {
                        sendResponse({data: user})
                        console.log('single user sent')
                    });
                    break;
                case Channels.get_session_request:
                    if (request.force_auth) {
                        console.log('got request about implicit authorization')
                        AuthHelper.authorize();
                    }
                    else {
                        console.log('got request about explicit authorization')
                        AuthHelper.authorize(false);
                    }
                    sendResponse({data: ''});
                    break;
                case 'request_error':
                    this.processError(request.error_code);
                    break;
            }
        });
    }

    processError(erorr_code: number) {

    }

    initMessagesCache(port: chrome.runtime.Port) {
        console.log('connected to port: ' + port.name);
        let key: string;
        let value: string;
        let subscription = Observable.interval(3000).subscribe(() => window.localStorage.setItem(key, value));
                
        port.onMessage.addListener(message => {
            if (message['remove']) {
                window.localStorage.removeItem(message['key']);
            }
            else if (key != message['key']) {
                window.localStorage.setItem(key, value);
                key = message['key'];
            }
            value = message['value'];                    
        });
        port.onDisconnect.addListener(() => {
            console.log('port disconnected: ' + port.name);
            subscription.unsubscribe();
            window.localStorage.setItem(key, value);
        });
    }

    ngOnDestroy() {
        console.log('background destroy');
    }

    private preAuthorize() {
        if (!window.localStorage.getItem(VKConsts.vk_access_token_id) || !window.localStorage.getItem(VKConsts.vk_auth_timestamp_id)) {
            console.log('unable to find auth session data');
            AuthHelper.authorize(false);        
        }
        else if ((Math.floor(Date.now() / 1000) - Number(window.localStorage.getItem(VKConsts.vk_auth_timestamp_id))) > 86400) {
            console.log('session expired, reauthorize');
            AuthHelper.authorize();
        }
    }
}