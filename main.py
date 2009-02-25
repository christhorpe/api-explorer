#!/usr/bin/env python
#
# Copyright 2007 Google Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

import os, httplib2
import wsgiref.handlers

from google.appengine.ext.webapp import template
from google.appengine.ext import webapp
from google.appengine.ext import db

# simple logger data model, we can hopefully use this to give us some analytics on Mashery in terms of request proxying and maybe load balancing
# remove before we redistribute
class LogRequest(db.Model):
    url = db.StringProperty(required=True)
    handler = db.StringProperty(required=True)
    api_key = db.StringProperty(default=None)
    api_method = db.StringProperty(default=None)
    requested_format = db.StringProperty(default=None)
    created = db.DateTimeProperty(auto_now_add=True)


def render_template(self, end_point, template_values):
    path = os.path.join(os.path.dirname(__file__), end_point)
    self.response.out.write(template.render(path, template_values))


class RootHandler(webapp.RequestHandler):
    def get(self):
        self.redirect("/explorer/")


class PassThroughHandler(webapp.RequestHandler):
    def get(self, requested_url):
        logrequest = LogRequest(url=requested_url, handler="PassThrough").put()
        self.response.out.write('docs in html')


class RateLimitedHandler(webapp.RequestHandler):
    def get(self, requested_url, api_method):
        logrequest = LogRequest(url=requested_url, handler="RateLimited", api_key=self.request.get("api_key"), api_method=api_method, requested_format=self.request.get("format")).put()
        format = self.request.get("format")
        if not format:
            format = "xml"
        if self.request.get("format") == "json":
            self.response.headers['Content-Type'] = 'application/javascript'
        else:
            self.response.headers['Content-Type'] = 'application/xml'
        if api_method == "search" or api_method == "all-subjects" or api_method == "content":
            render_template(self, "canned_responses/"+ api_method +"."+ format, "")
        elif api_method == "":
            render_template(self, "canned_responses/root."+ format, "")

import urllib
def make_proxy_handler(prefix):
    class ProxyHandler(webapp.RequestHandler):
        def get(self, path):
            url = prefix + path
            if self.request.query_string:
                url += '?' + self.request.query_string
            u = urllib.urlopen(url)
            self.response.headers['Content-Type'] = u.headers['content-type']
            self.response.out.write(u.read())
    return ProxyHandler

def main():
    application = webapp.WSGIApplication([
        ('/', RootHandler),
        ('(/content/(search).*)', RateLimitedHandler),
        ('(/content/(all-subjects).*)', RateLimitedHandler),
        ('(/content/(content)/.*)', RateLimitedHandler),
        ('(/content().*)', RateLimitedHandler),
        ('(/gdn-api/.*)', make_proxy_handler('http://openapi.gucode.co.uk:8300')),
    ], debug=True)
    wsgiref.handlers.CGIHandler().run(application)


if __name__ == '__main__':
    main()
