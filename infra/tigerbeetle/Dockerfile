FROM ghcr.io/tigerbeetle/tigerbeetle AS tb

FROM alpine:3.21

COPY --from=tb /tigerbeetle /usr/local/bin/tigerbeetle
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

VOLUME /data

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
