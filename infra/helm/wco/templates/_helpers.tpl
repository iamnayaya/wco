{{/*
Shared helpers for the wco chart.
*/}}
{{- define "wco.name" -}}
{{- .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "wco.fullname" -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "wco.labels" -}}
app.kubernetes.io/name: {{ include "wco.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/part-of: wco
app.kubernetes.io/environment: {{ .Values.global.environment }}
{{- end -}}
