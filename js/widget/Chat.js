/*
 *     Copyright (c) 2012-2014 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 *     This file is part of the chat widget.
 *
 *     chat is free software: you can redistribute it and/or modify
 *     it under the terms of the GNU Affero General Public License as published
 *     by the Free Software Foundation, either version 3 of the License, or (at
 *     your option) any later version.
 *
 *     chat is distributed in the hope that it will be useful, but
 *     WITHOUT ANY WARRANTY; without even the implied warranty of
 *     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero
 *     General Public License for more details.
 *
 *     You should have received a copy of the GNU Affero General Public License
 *     along with chat. If not, see <http://www.gnu.org/licenses/>.
 *
 *     Linking this library statically or dynamically with other modules is
 *     making a combined work based on this library.  Thus, the terms and
 *     conditions of the GNU Affero General Public License cover the whole
 *     combination.
 *
 *     As a special exception, the copyright holders of this library give you
 *     permission to link this library with independent modules to produce an
 *     executable, regardless of the license terms of these independent
 *     modules, and to copy and distribute the resulting executable under
 *     terms of your choice, provided that you also meet, for each linked
 *     independent module, the terms and conditions of the license of that
 *     module.  An independent module is a module which is not derived from
 *     or based on this library.  If you modify this library, you may extend
 *     this exception to your version of the library, but you are not
 *     obligated to do so.  If you do not wish to do so, delete this
 *     exception statement from your version.
 *
 */

(function () {

    "use strict";

    /******************************************************************************/
    /********************************* PUBLIC *************************************/
    /******************************************************************************/

    var ChatLog = function ChatLog() {
        MashupPlatform.wiring.registerCallback("profile", handlerProfile.bind(this));
        MashupPlatform.wiring.registerCallback("msg", getMsg.bind(this));
        MashupPlatform.wiring.registerCallback("msgAck", getMsgAck.bind(this));

        MashupPlatform.widget.context.registerCallback(function (newValues) {
            if ("heightInPixels" in newValues || "widthInPixels" in newValues) {
                this.repaint();
            }
        }.bind(this));

        this.profile = null;
        this.profileVcard = null;
        this.contact = null;
        
        this.statePropertyLog = MashupPlatform.widget.getVariable("log");
        try {
            this.log = JSON.parse(this.statePropertyLog.get());
        } catch (e) {
            this.log = {};
        }
        
        this.loadingImg = "images/loading4.gif";
        this.okImg = "images/tick.png";
        this.failImg = "images/cancel.png";
        this.profile = {};
    };

    ChatLog.prototype.init = function () {

        // Create a Vertical Layout
        this.layout = new StyledElements.VerticalLayout();
        this.layout.insertInto(document.body);

        // Use the south container for providing a bar for adding messages
        this.layout.south.addClassName('action_bar se-input-group');

        // Create Text Input
        this.textInput = new StyledElements.TextField({
            'id': 'input'
        });
        this.layout.south.appendChild(this.textInput);

        // Create send button on the right of Text Input
        this.sendButton = new StyledElements.Button({
            id: 'send',
            text: 'Send'
        });
        this.sendButton.disable();
        this.layout.south.appendChild(this.sendButton);

        // Set handler of the text input
        this.textInput.addEventListener('change',  function (input) {
            this.sendButton.setDisabled(input.getValue().trim().length === 0);
        }.bind(this));

        // Set handler of send button
        this.sendButton.addEventListener('click', handlerSendButton.bind(this));

        this.sendMenu = new StyledElements.PopupMenu();
        this.sendMenu.append(new StyledElements.SendMenuItems('msgOut', messageGetter.bind(this)));
        
        var myfriend = document.createElement("span");
        myfriend.classList.add("myfriend");
        myfriend.textContent = "";
        this.layout.north.appendChild(myfriend);
        
        var me = document.createElement("span");
        me.classList.add("me");
        me.textContent = MashupPlatform.context.get("username");
        this.layout.north.appendChild(me);
        
        this.repaint();
    };

    ChatLog.prototype.repaint = function () {
        if (this.layout) {
            this.layout.repaint();
        }
    };

    /******************************************************************************/
    /********************************* PRIVATE ************************************/
    /******************************************************************************/

    /******************************** HANDLERS ************************************/

    var handlerSendButton = function handlerSendButton(button) {
        var text;
        
        text = this.textInput.getValue().trim();

        if (text === '') {
            return;
        }

        this.sendMenu.show(button.getBoundingClientRect());
    };

    var messageGetter = function messageGetter() {
        var balloon, text;
        var date = new Date();
        
        text = this.textInput.getValue().trim();
        
        balloon = document.createElement('div');
        var ballonId = "ballon_" + date.valueOf();
        balloon.setAttribute("id", ballonId);
        balloon.classList.add('balloon', 'right');
        balloon.textContent = text;
        loading.call(this, balloon);
        this.textInput.setValue('');
        this.sendButton.disable();

        this.layout.center.appendChild(balloon);
        moveDownScroll.call(this);
        storeMsg.call(this, this.contact, text, 'sent', ballonId);
        
        return {id: ballonId, recipient: this.profileVcard, text: text};
    };

    var handlerProfile = function handlerProfile(profile) {
        var vcard = new Vcard();
        var id = "";
        this.profileVcard = profile;
        this.profile = vcard.parser(this.profileVcard);
        if (vcard.getValue('FN', 0)) {
            id = vcard.getValue('FN', 0);
        } else {
            id = vcard.getValue('EMAIL', 0);
        }
        
        this.contact = id;
        
        this.layout.north.wrapperElement.getElementsByTagName("span")[0].textContent = id;
        this.layout.center.clear();
        
        if (this.contact in this.log) {
            var history = this.log[this.contact];
            for (var i = 0; i < history.length; i++) {
                var msg = history[i];
                
                var balloon = document.createElement('div');
                balloon.setAttribute("id", msg.id);
                balloon.classList.add('balloon');
                balloon.textContent = msg.text;
                
                this.layout.center.appendChild(balloon);
                if (msg.type === 'recv') {
                    balloon.classList.add('left');
                } else {
                    balloon.classList.add('right');
                    var img = document.createElement('img');
                    img.setAttribute("src", msg.img);
                    balloon.appendChild(img);
                }
            }
        }
        
        moveDownScroll.call(this);
    };

    var getMsg = function getMsg(jsonMsg) {
        /* this jsonMsg should be:
         * json = {
         *      contact: contact FN,
         *      msg: msg received,
         *      source: protocol source
         * }
         * */
        var balloon, ballonId;
        var date = new Date();
        
        var json = JSON.parse(jsonMsg);
        
        if (this.contact === json.contact) {
            balloon = document.createElement('div');
            ballonId = "ballon_" + date.valueOf();
            balloon.setAttribute("id", ballonId);
            balloon.classList.add('balloon', 'left');
            balloon.textContent = json.msg;
            this.layout.center.appendChild(balloon);
            moveDownScroll.call(this);
        }
        storeMsg.call(this, json.contact, json.msg, 'recv', ballonId);
    };

    var getMsgAck = function getMsgAck(e) {
        var img, balloon;
        var i;
        var notFinded, endLog;
        
        if (this.contact in this.log) {
            i = 0;
            notFinded = this.log[this.contact][i].id !== e.id;
            endLog = i < this.log[this.contact].length;
            while (notFinded && endLog) {
                i++;
                notFinded = this.log[this.contact][i].id !== e.id;
                endLog = i < this.log[this.contact].length;
            }
            if (e.result === "success") {
                img = this.okImg;
            } else {
                img = this.failImg;
            }
            this.log[this.contact][i].img = img;
            this.statePropertyLog.set(JSON.stringify(this.log));
        }
            
        balloon = document.getElementById(e.id);
        balloon.getElementsByTagName("img")[0].setAttribute("src", img);
    };

    var loading = function loading(balloon) {
        var img = document.createElement('img');
        img.setAttribute("src", this.loadingImg);
        balloon.appendChild(img);
    };

    var storeMsg = function storeMsg(contact, msg, type, id) {
        var json;

        if (!(contact in this.log)) {
            this.log[contact] = [];
        }
        
        json = {
            "type" : type,
            "text" : msg,
            "img" : this.loadingImg,
            "id" : id
        };
        this.log[contact].push(json);

        this.statePropertyLog.set(JSON.stringify(this.log));
    };

    var moveDownScroll = function moveDownScroll() {
        var clientHeight = this.layout.center.wrapperElement.clientHeight;
        var scrollHeight = this.layout.center.wrapperElement.scrollHeight;
        this.layout.center.wrapperElement.scrollTop = scrollHeight - clientHeight;
    };

    window.ChatLog = ChatLog;

})();
